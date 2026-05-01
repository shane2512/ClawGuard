import { z } from 'zod';

// ─────────────────────────────────────────────────────────────────────────────
// Zod schema for runtime validation
// ─────────────────────────────────────────────────────────────────────────────

export const CapabilityManifestSchema = z.object({
  skillId: z.string().min(1, 'skillId cannot be empty'),
  allowedTools: z.array(z.string()).default([]),
  blockedTools: z.array(z.string()).default([]),
  maxExternalCallsPerSession: z.number().int().positive().default(20),
  /** SHA-256 hash of the canonical JSON representation of this manifest */
  manifestHash: z.string().optional(),
  /** 0G Storage KV address — populated after publishManifest() call */
  onChainAddress: z.string().optional(),
  /** ENS subname, e.g. "defi-reader.skills.clawhub.eth" */
  ensSubname: z.string().optional(),
  /** ISO timestamp of when manifest was first created */
  createdAt: z.string().optional(),
});

// ─────────────────────────────────────────────────────────────────────────────
// TypeScript interface derived from the schema (single source of truth)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Canonical capability declaration for an OpenClaw skill.
 *
 * A CapabilityManifest defines exactly what tools a skill is permitted to call.
 * Once hashed and anchored on 0G Chain, the declaration becomes immutable.
 */
export type CapabilityManifest = z.infer<typeof CapabilityManifestSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// ViolationEvent — emitted whenever a blocked tool call is intercepted
// ─────────────────────────────────────────────────────────────────────────────

export const ViolationEventSchema = z.object({
  /** The ID of the skill that attempted the blocked call */
  skillId: z.string(),
  /** The tool name that was blocked (e.g. "wallet.transfer") */
  blockedTool: z.string(),
  /** The agent runtime ID that was running when the violation occurred */
  agentId: z.string(),
  /** Unix timestamp (ms) of when the violation occurred */
  timestamp: z.number(),
  /** Unique session identifier to group events within one agent run */
  sessionId: z.string(),
  /** Reason for the block (for structured error reporting) */
  reason: z.enum(['NOT_IN_ALLOWED_TOOLS', 'IN_BLOCKED_TOOLS', 'MANIFEST_NOT_FOUND', 'MANIFEST_TAMPERED', 'SESSION_LIMIT_EXCEEDED', 'FETCH_ERROR']),
});

/**
 * Represents a single blocked tool-call event.
 *
 * SECURITY RULE (S-02): Do NOT include wallet addresses, private keys,
 * user data, or full tool call parameters. Log only the fields below.
 */
export type ViolationEvent = z.infer<typeof ViolationEventSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// ClawGuardConfig — integration config for wrapWithClawGuard()
// ─────────────────────────────────────────────────────────────────────────────

export const ClawGuardConfigSchema = z.object({
  /** Agent identifier used in ViolationEvents */
  agentId: z.string().min(1),
  /**
   * If true, allow tool calls when manifest fetch fails.
   * DEFAULT: false (fail-closed — deny on any error).
   * Only set to true in development/testing — NEVER in production.
   */
  failOpen: z.boolean().default(false),
  /**
   * Address of the SkillRegistry smart contract on 0G Chain.
   * Required for on-chain hash verification (Phase 2+).
   * Optional in Phase 1 (local-only mode).
   */
  registryAddress: z.string().optional(),
  /**
   * 0G Storage RPC endpoint (Phase 2+).
   * When set with zgManifestRootHash, manifests are fetched from 0G Storage.
   */
  zgStorageRpc: z.string().optional(),
  /** 0G Storage indexer RPC (defaults to zgStorageRpc if not set) */
  zgIndexerRpc: z.string().optional(),
  /** Wallet private key for 0G Storage write operations */
  zgPrivateKey: z.string().optional(),
  /**
   * 0G Storage file root hash for the skill manifest.
   * Obtained from ENS clawguard.storageKey text record after publishing.
   * Format: 0x-prefixed 32-byte hex string.
   */
  zgManifestRootHash: z.string().optional(),
  /**
   * Local manifest store override (key = skillId, value = manifest).
   * Used in Phase 1 for local testing without 0G Storage.
   * Overrides 0G Storage lookups when provided.
   */
  localManifestStore: z.record(z.string(), z.unknown()).optional(),
  /**
   * Cache TTL in milliseconds (default: 60s).
   * After TTL expires, manifest will be re-fetched from 0G Storage.
   */
  cacheTtlMs: z.number().positive().default(60_000),
});

export type ClawGuardConfig = z.infer<typeof ClawGuardConfigSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// VerificationStatus — mirrors SkillRegistry.sol enum
// ─────────────────────────────────────────────────────────────────────────────

export enum VerificationStatus {
  PENDING = 'PENDING',
  VERIFIED = 'VERIFIED',
  CAPABILITY_MISMATCH = 'CAPABILITY_MISMATCH',
}

// ─────────────────────────────────────────────────────────────────────────────
// ToolCallRequest — the shape of a tool call entering the middleware
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Represents an intercepted tool call from a skill.
 */
export interface ToolCallRequest {
  /** The skill requesting the tool call */
  skillId: string;
  /** The tool being requested (e.g. "wallet.transfer") */
  toolName: string;
  /** Tool parameters — NOT logged to 0G Storage Log for security */
  params: Record<string, unknown>;
  /** Session ID — links this call to its ViolationEvents */
  sessionId: string;
}

/**
 * Structured error returned to a skill when a tool call is blocked.
 * The agent must NOT crash — it receives this error and handles it gracefully.
 */
export interface BlockedCallError {
  blocked: true;
  skillId: string;
  toolName: string;
  reason: ViolationEvent['reason'];
  message: string;
}
