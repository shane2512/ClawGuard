import { LRUCache } from 'lru-cache';
import {
  CapabilityManifest,
  ClawGuardConfig,
  ClawGuardConfigSchema,
  ViolationEvent,
  BlockedCallError,
} from './types';
import { createManifestCache } from './cache';

// ─────────────────────────────────────────────────────────────────────────────
// Public types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Context injected by the OpenClaw runtime into every tool call.
 * ClawGuard reads `skillId` and `sessionId` from this context.
 * A rogue skill cannot forge these — they are set by the runtime, not the skill.
 */
export interface SkillContext {
  /** ID of the skill making the tool call */
  skillId: string;
  /** Session identifier — groups events from one agent run together */
  sessionId: string;
  [key: string]: unknown;
}

/**
 * OpenClaw's native tool_dispatch signature.
 * ClawGuard wraps this without modifying OpenClaw source (Rule A-01).
 */
export type ToolDispatchFn = (
  toolName: string,
  params: Record<string, unknown>,
  context?: SkillContext,
) => Promise<unknown>;

/**
 * Callback invoked whenever a tool call is blocked.
 * In Phase 2 this will pipe events to 0G Storage Log.
 */
export type ViolationHandler = (event: ViolationEvent) => void | Promise<void>;

// ─────────────────────────────────────────────────────────────────────────────
// Internal state (closed over by each wrapped dispatch instance)
// ─────────────────────────────────────────────────────────────────────────────

interface ClawGuardState {
  config: ClawGuardConfig;
  cache: LRUCache<string, CapabilityManifest>;
  /** key: `${sessionId}:${skillId}` → number of external calls made */
  sessionCallCounts: Map<string, number>;
  violationHandlers: ViolationHandler[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Main export
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Wraps OpenClaw's `tool_dispatch` with ClawGuard capability enforcement.
 *
 * This is the ONLY integration point — replace `agent.tool_dispatch` with
 * the returned function. The agent needs no other changes (NFR-08: 3 lines max).
 *
 * Enforcement flow per tool call:
 *  1. Fetch manifest from cache or local store (Phase 1) / 0G KV (Phase 2)
 *  2. Check session call limit (max_external_calls_per_session)
 *  3. Check `blocked_tools` list
 *  4. Check `allowed_tools` list
 *  5. Forward to original dispatch if all checks pass
 *
 * On any fetch failure → fail-closed by default (Rule A-02).
 *
 * @param originalDispatch - The original OpenClaw tool_dispatch function
 * @param config           - ClawGuard configuration (agentId is required)
 * @returns A new function with the same signature as tool_dispatch
 *
 * @example
 * ```typescript
 * import { wrapWithClawGuard } from '@clawguard/core';
 * agent.tool_dispatch = wrapWithClawGuard(agent.tool_dispatch, {
 *   agentId: 'defi-monitor-agent',
 *   failOpen: false,
 * });
 * ```
 */
export function wrapWithClawGuard(
  originalDispatch: ToolDispatchFn,
  config: Partial<ClawGuardConfig> & { agentId: string },
): ToolDispatchFn {
  const validatedConfig = ClawGuardConfigSchema.parse(config);

  const state: ClawGuardState = {
    config: validatedConfig,
    cache: createManifestCache(validatedConfig.cacheTtlMs),
    sessionCallCounts: new Map(),
    violationHandlers: [],
  };

  // Expose state for addViolationHandler() — stored on function object
  const wrappedDispatch: ToolDispatchFn & { __cgState?: ClawGuardState } =
    async function clawGuardDispatch(
      toolName: string,
      params: Record<string, unknown>,
      context?: SkillContext,
    ): Promise<unknown> {
      // If no skill context provided, we cannot determine the caller — fail-closed
      if (!context?.skillId) {
        const errorMsg =
          `[ClawGuard] BLOCKED: no skill context provided for tool "${toolName}". ` +
          `Ensure your OpenClaw agent passes skillId in the tool call context.`;
        console.error(errorMsg);
        return buildBlockedError('unknown', toolName, 'MANIFEST_NOT_FOUND', errorMsg);
      }

      const { skillId, sessionId = 'default-session' } = context;

      // ── Step 1: Fetch manifest (cache-first) ──────────────────────────────
      let manifest: CapabilityManifest;
      try {
        manifest = await fetchManifest(skillId, state);
      } catch (err) {
        const reason: ViolationEvent['reason'] = 'FETCH_ERROR';
        const event = buildViolationEvent(
          skillId, toolName, validatedConfig.agentId, sessionId, reason,
        );
        await emitViolation(event, state);

        if (validatedConfig.failOpen) {
          console.warn(
            `[ClawGuard] WARN: manifest fetch failed for "${skillId}", failing OPEN (dev mode)`,
          );
          return originalDispatch(toolName, params, context);
        }

        const msg = `[ClawGuard] BLOCKED: cannot fetch manifest for skill "${skillId}": ${String(err)}`;
        console.error(msg);
        return buildBlockedError(skillId, toolName, reason, msg);
      }

      // ── Step 2: Session call limit ─────────────────────────────────────────
      const sessionKey = `${sessionId}:${skillId}`;
      const callCount = (state.sessionCallCounts.get(sessionKey) ?? 0) + 1;
      state.sessionCallCounts.set(sessionKey, callCount);

      if (callCount > manifest.maxExternalCallsPerSession) {
        const reason: ViolationEvent['reason'] = 'SESSION_LIMIT_EXCEEDED';
        const event = buildViolationEvent(
          skillId, toolName, validatedConfig.agentId, sessionId, reason,
        );
        await emitViolation(event, state);
        const msg =
          `[ClawGuard] BLOCKED: skill "${skillId}" exceeded ` +
          `max_external_calls_per_session (${manifest.maxExternalCallsPerSession})`;
        console.error(msg);
        return buildBlockedError(skillId, toolName, reason, msg);
      }

      // ── Step 3: Explicit blocked_tools check ──────────────────────────────
      if (manifest.blockedTools.includes(toolName)) {
        const reason: ViolationEvent['reason'] = 'IN_BLOCKED_TOOLS';
        const event = buildViolationEvent(
          skillId, toolName, validatedConfig.agentId, sessionId, reason,
        );
        await emitViolation(event, state);
        const msg =
          `[ClawGuard] BLOCKED: "${toolName}" is in the blocked_tools list for skill "${skillId}"`;
        console.error(msg);
        return buildBlockedError(skillId, toolName, reason, msg);
      }

      // ── Step 4: allowed_tools membership check ────────────────────────────
      if (!manifest.allowedTools.includes(toolName)) {
        const reason: ViolationEvent['reason'] = 'NOT_IN_ALLOWED_TOOLS';
        const event = buildViolationEvent(
          skillId, toolName, validatedConfig.agentId, sessionId, reason,
        );
        await emitViolation(event, state);
        const msg =
          `[ClawGuard] BLOCKED: "${toolName}" not in declared capabilities for skill "${skillId}"`;
        console.error(msg);
        return buildBlockedError(skillId, toolName, reason, msg);
      }

      // ── Step 5: Allowed — forward to original dispatch ────────────────────
      if (process.env['NODE_ENV'] !== 'test') {
        console.log(`[ClawGuard] ALLOWED: "${toolName}" → skill "${skillId}"`);
      }
      return originalDispatch(toolName, params, context);
    };

  wrappedDispatch.__cgState = state;
  return wrappedDispatch;
}

/**
 * Registers a violation event handler on a ClawGuard-wrapped dispatch function.
 * Use this in Phase 2 to pipe events to 0G Storage Log.
 *
 * @param wrappedDispatch - The function returned by wrapWithClawGuard()
 * @param handler         - Called with each ViolationEvent before it is logged
 */
export function addViolationHandler(
  wrappedDispatch: ToolDispatchFn,
  handler: ViolationHandler,
): void {
  const state = (wrappedDispatch as { __cgState?: ClawGuardState }).__cgState;
  if (!state) {
    throw new Error(
      'addViolationHandler: provided function is not a ClawGuard-wrapped dispatch. ' +
      'Call wrapWithClawGuard() first.',
    );
  }
  state.violationHandlers.push(handler);
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetches a manifest for the given skillId.
 * Priority: in-memory cache → local store (Phase 1) → 0G Storage KV (Phase 2)
 */
async function fetchManifest(
  skillId: string,
  state: ClawGuardState,
): Promise<CapabilityManifest> {
  // 1. In-memory cache hit
  const cached = state.cache.get(skillId);
  if (cached) return cached;

  // 2. Local manifest store (Phase 1 — no blockchain needed)
  if (state.config.localManifestStore) {
    const local = state.config.localManifestStore[skillId];
    if (local) {
      const manifest = local as CapabilityManifest;
      state.cache.set(skillId, manifest);
      return manifest;
    }
  }

  // 3. 0G Storage KV fetch (Phase 2)
  if (state.config.zgStorageRpc) {
    // Lazy-import to avoid circular dependency in tests
    const { ZGStorageClient } = await import('./storage');
    const storageClient = new ZGStorageClient({
      rpcUrl: state.config.zgStorageRpc,
      indexerRpc: state.config.zgIndexerRpc ?? state.config.zgStorageRpc,
      kvNodeRpc: state.config.zgKvNodeRpc ?? 'http://3.101.147.150:6789',
      privateKey: state.config.zgPrivateKey ?? '',
      streamId: state.config.zgStreamId,
    });
    const manifest = await storageClient.fetchManifest(skillId, state.config.registryAddress ? undefined : undefined);
    state.cache.set(skillId, manifest);
    return manifest;
  }

  throw new Error(
    `No manifest found for skill "${skillId}". ` +
    `Provide localManifestStore in ClawGuardConfig for Phase 1 testing, ` +
    `or configure zgStorageRpc for Phase 2.`,
  );
}

/** Constructs a ViolationEvent — only safe fields, no wallet/key data (Rule S-02) */
function buildViolationEvent(
  skillId: string,
  blockedTool: string,
  agentId: string,
  sessionId: string,
  reason: ViolationEvent['reason'],
): ViolationEvent {
  return {
    skillId,
    blockedTool,
    agentId,
    timestamp: Date.now(),
    sessionId,
    reason,
  };
}

/** Runs all registered violation handlers, swallowing individual handler errors */
async function emitViolation(
  event: ViolationEvent,
  state: ClawGuardState,
): Promise<void> {
  for (const handler of state.violationHandlers) {
    try {
      await handler(event);
    } catch (err) {
      console.error(`[ClawGuard] Violation handler threw an error:`, err);
    }
  }
}

/** Constructs a structured BlockedCallError that the agent can handle gracefully (FR-14) */
function buildBlockedError(
  skillId: string,
  toolName: string,
  reason: ViolationEvent['reason'],
  message: string,
): BlockedCallError {
  return { blocked: true, skillId, toolName, reason, message };
}
