import { ClawGuardConfig, ViolationEvent } from './types';
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
export type ToolDispatchFn = (toolName: string, params: Record<string, unknown>, context?: SkillContext) => Promise<unknown>;
/**
 * Callback invoked whenever a tool call is blocked.
 * In Phase 2 this will pipe events to 0G Storage Log.
 */
export type ViolationHandler = (event: ViolationEvent) => void | Promise<void>;
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
export declare function wrapWithClawGuard(originalDispatch: ToolDispatchFn, config: Partial<ClawGuardConfig> & {
    agentId: string;
}): ToolDispatchFn;
/**
 * Registers a violation event handler on a ClawGuard-wrapped dispatch function.
 * Use this in Phase 2 to pipe events to 0G Storage Log.
 *
 * @param wrappedDispatch - The function returned by wrapWithClawGuard()
 * @param handler         - Called with each ViolationEvent before it is logged
 */
export declare function addViolationHandler(wrappedDispatch: ToolDispatchFn, handler: ViolationHandler): void;
//# sourceMappingURL=middleware.d.ts.map