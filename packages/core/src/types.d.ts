import { z } from 'zod';
export declare const CapabilityManifestSchema: z.ZodObject<{
    skillId: z.ZodString;
    allowedTools: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    blockedTools: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    maxExternalCallsPerSession: z.ZodDefault<z.ZodNumber>;
    /** SHA-256 hash of the canonical JSON representation of this manifest */
    manifestHash: z.ZodOptional<z.ZodString>;
    /** 0G Storage KV address — populated after publishManifest() call */
    onChainAddress: z.ZodOptional<z.ZodString>;
    /** ENS subname, e.g. "defi-reader.skills.clawhub.eth" */
    ensSubname: z.ZodOptional<z.ZodString>;
    /** ISO timestamp of when manifest was first created */
    createdAt: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    skillId: string;
    allowedTools: string[];
    blockedTools: string[];
    maxExternalCallsPerSession: number;
    manifestHash?: string | undefined;
    onChainAddress?: string | undefined;
    ensSubname?: string | undefined;
    createdAt?: string | undefined;
}, {
    skillId: string;
    allowedTools?: string[] | undefined;
    blockedTools?: string[] | undefined;
    maxExternalCallsPerSession?: number | undefined;
    manifestHash?: string | undefined;
    onChainAddress?: string | undefined;
    ensSubname?: string | undefined;
    createdAt?: string | undefined;
}>;
/**
 * Canonical capability declaration for an OpenClaw skill.
 *
 * A CapabilityManifest defines exactly what tools a skill is permitted to call.
 * Once hashed and anchored on 0G Chain, the declaration becomes immutable.
 */
export type CapabilityManifest = z.infer<typeof CapabilityManifestSchema>;
export declare const ViolationEventSchema: z.ZodObject<{
    /** The ID of the skill that attempted the blocked call */
    skillId: z.ZodString;
    /** The tool name that was blocked (e.g. "wallet.transfer") */
    blockedTool: z.ZodString;
    /** The agent runtime ID that was running when the violation occurred */
    agentId: z.ZodString;
    /** Unix timestamp (ms) of when the violation occurred */
    timestamp: z.ZodNumber;
    /** Unique session identifier to group events within one agent run */
    sessionId: z.ZodString;
    /** Reason for the block (for structured error reporting) */
    reason: z.ZodEnum<["NOT_IN_ALLOWED_TOOLS", "IN_BLOCKED_TOOLS", "MANIFEST_NOT_FOUND", "MANIFEST_TAMPERED", "SESSION_LIMIT_EXCEEDED", "FETCH_ERROR"]>;
}, "strip", z.ZodTypeAny, {
    skillId: string;
    blockedTool: string;
    agentId: string;
    timestamp: number;
    sessionId: string;
    reason: "NOT_IN_ALLOWED_TOOLS" | "IN_BLOCKED_TOOLS" | "MANIFEST_NOT_FOUND" | "MANIFEST_TAMPERED" | "SESSION_LIMIT_EXCEEDED" | "FETCH_ERROR";
}, {
    skillId: string;
    blockedTool: string;
    agentId: string;
    timestamp: number;
    sessionId: string;
    reason: "NOT_IN_ALLOWED_TOOLS" | "IN_BLOCKED_TOOLS" | "MANIFEST_NOT_FOUND" | "MANIFEST_TAMPERED" | "SESSION_LIMIT_EXCEEDED" | "FETCH_ERROR";
}>;
/**
 * Represents a single blocked tool-call event.
 *
 * SECURITY RULE (S-02): Do NOT include wallet addresses, private keys,
 * user data, or full tool call parameters. Log only the fields below.
 */
export type ViolationEvent = z.infer<typeof ViolationEventSchema>;
export declare const ClawGuardConfigSchema: z.ZodObject<{
    /** Agent identifier used in ViolationEvents */
    agentId: z.ZodString;
    /**
     * If true, allow tool calls when manifest fetch fails.
     * DEFAULT: false (fail-closed — deny on any error).
     * Only set to true in development/testing — NEVER in production.
     */
    failOpen: z.ZodDefault<z.ZodBoolean>;
    /**
     * Address of the SkillRegistry smart contract on 0G Chain.
     * Required for on-chain hash verification (Phase 2+).
     * Optional in Phase 1 (local-only mode).
     */
    registryAddress: z.ZodOptional<z.ZodString>;
    /**
     * 0G Storage RPC endpoint (Phase 2+).
     * When set with zgManifestRootHash, manifests are fetched from 0G Storage.
     */
    zgStorageRpc: z.ZodOptional<z.ZodString>;
    /** 0G Storage indexer RPC (defaults to zgStorageRpc if not set) */
    zgIndexerRpc: z.ZodOptional<z.ZodString>;
    /** Wallet private key for 0G Storage write operations */
    zgPrivateKey: z.ZodOptional<z.ZodString>;
    /**
     * 0G Storage file root hash for the skill manifest.
     * Obtained from ENS clawguard.storageKey text record after publishing.
     * Format: 0x-prefixed 32-byte hex string.
     */
    zgManifestRootHash: z.ZodOptional<z.ZodString>;
    /**
     * Local manifest store override (key = skillId, value = manifest).
     * Used in Phase 1 for local testing without 0G Storage.
     * Overrides 0G Storage lookups when provided.
     */
    localManifestStore: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    /**
     * Cache TTL in milliseconds (default: 60s).
     * After TTL expires, manifest will be re-fetched from 0G Storage.
     */
    cacheTtlMs: z.ZodDefault<z.ZodNumber>;
    /**
     * When true, automatically uploads every ViolationEvent to 0G Storage Log
     * as a tamper-proof, append-only audit trail entry.
     * Requires zgStorageRpc, zgIndexerRpc, zgPrivateKey (or ZG_* env vars).
     */
    auditLog: z.ZodDefault<z.ZodBoolean>;
    /**
     * ENS skill name (e.g. "defi-reader.skills.clawhub.eth").
     * When set and zgManifestRootHash is absent, the middleware auto-resolves
     * ENS → storageKey on the first cache miss (no hardcoded hash needed).
     */
    ensName: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    agentId: string;
    failOpen: boolean;
    cacheTtlMs: number;
    auditLog: boolean;
    registryAddress?: string | undefined;
    zgStorageRpc?: string | undefined;
    zgIndexerRpc?: string | undefined;
    zgPrivateKey?: string | undefined;
    zgManifestRootHash?: string | undefined;
    localManifestStore?: Record<string, unknown> | undefined;
    ensName?: string | undefined;
}, {
    agentId: string;
    failOpen?: boolean | undefined;
    registryAddress?: string | undefined;
    zgStorageRpc?: string | undefined;
    zgIndexerRpc?: string | undefined;
    zgPrivateKey?: string | undefined;
    zgManifestRootHash?: string | undefined;
    localManifestStore?: Record<string, unknown> | undefined;
    cacheTtlMs?: number | undefined;
    auditLog?: boolean | undefined;
    ensName?: string | undefined;
}>;
export type ClawGuardConfig = z.infer<typeof ClawGuardConfigSchema>;
export declare enum VerificationStatus {
    PENDING = "PENDING",
    VERIFIED = "VERIFIED",
    CAPABILITY_MISMATCH = "CAPABILITY_MISMATCH"
}
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
//# sourceMappingURL=types.d.ts.map