"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VerificationStatus = exports.ClawGuardConfigSchema = exports.ViolationEventSchema = exports.CapabilityManifestSchema = void 0;
const zod_1 = require("zod");
// ─────────────────────────────────────────────────────────────────────────────
// Zod schema for runtime validation
// ─────────────────────────────────────────────────────────────────────────────
exports.CapabilityManifestSchema = zod_1.z.object({
    skillId: zod_1.z.string().min(1, 'skillId cannot be empty'),
    allowedTools: zod_1.z.array(zod_1.z.string()).default([]),
    blockedTools: zod_1.z.array(zod_1.z.string()).default([]),
    maxExternalCallsPerSession: zod_1.z.number().int().positive().default(20),
    /** SHA-256 hash of the canonical JSON representation of this manifest */
    manifestHash: zod_1.z.string().optional(),
    /** 0G Storage KV address — populated after publishManifest() call */
    onChainAddress: zod_1.z.string().optional(),
    /** ENS subname, e.g. "defi-reader.skills.clawhub.eth" */
    ensSubname: zod_1.z.string().optional(),
    /** ISO timestamp of when manifest was first created */
    createdAt: zod_1.z.string().optional(),
});
// ─────────────────────────────────────────────────────────────────────────────
// ViolationEvent — emitted whenever a blocked tool call is intercepted
// ─────────────────────────────────────────────────────────────────────────────
exports.ViolationEventSchema = zod_1.z.object({
    /** The ID of the skill that attempted the blocked call */
    skillId: zod_1.z.string(),
    /** The tool name that was blocked (e.g. "wallet.transfer") */
    blockedTool: zod_1.z.string(),
    /** The agent runtime ID that was running when the violation occurred */
    agentId: zod_1.z.string(),
    /** Unix timestamp (ms) of when the violation occurred */
    timestamp: zod_1.z.number(),
    /** Unique session identifier to group events within one agent run */
    sessionId: zod_1.z.string(),
    /** Reason for the block (for structured error reporting) */
    reason: zod_1.z.enum(['NOT_IN_ALLOWED_TOOLS', 'IN_BLOCKED_TOOLS', 'MANIFEST_NOT_FOUND', 'MANIFEST_TAMPERED', 'SESSION_LIMIT_EXCEEDED', 'FETCH_ERROR']),
});
// ─────────────────────────────────────────────────────────────────────────────
// ClawGuardConfig — integration config for wrapWithClawGuard()
// ─────────────────────────────────────────────────────────────────────────────
exports.ClawGuardConfigSchema = zod_1.z.object({
    /** Agent identifier used in ViolationEvents */
    agentId: zod_1.z.string().min(1),
    /**
     * If true, allow tool calls when manifest fetch fails.
     * DEFAULT: false (fail-closed — deny on any error).
     * Only set to true in development/testing — NEVER in production.
     */
    failOpen: zod_1.z.boolean().default(false),
    /**
     * Address of the SkillRegistry smart contract on 0G Chain.
     * Required for on-chain hash verification (Phase 2+).
     * Optional in Phase 1 (local-only mode).
     */
    registryAddress: zod_1.z.string().optional(),
    /**
     * 0G Storage RPC endpoint (Phase 2+).
     * When set with zgManifestRootHash, manifests are fetched from 0G Storage.
     */
    zgStorageRpc: zod_1.z.string().optional(),
    /** 0G Storage indexer RPC (defaults to zgStorageRpc if not set) */
    zgIndexerRpc: zod_1.z.string().optional(),
    /** Wallet private key for 0G Storage write operations */
    zgPrivateKey: zod_1.z.string().optional(),
    /**
     * 0G Storage file root hash for the skill manifest.
     * Obtained from ENS clawguard.storageKey text record after publishing.
     * Format: 0x-prefixed 32-byte hex string.
     */
    zgManifestRootHash: zod_1.z.string().optional(),
    /**
     * Local manifest store override (key = skillId, value = manifest).
     * Used in Phase 1 for local testing without 0G Storage.
     * Overrides 0G Storage lookups when provided.
     */
    localManifestStore: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).optional(),
    /**
     * Cache TTL in milliseconds (default: 60s).
     * After TTL expires, manifest will be re-fetched from 0G Storage.
     */
    cacheTtlMs: zod_1.z.number().positive().default(60_000),
    /**
     * When true, automatically uploads every ViolationEvent to 0G Storage Log
     * as a tamper-proof, append-only audit trail entry.
     * Requires zgStorageRpc, zgIndexerRpc, zgPrivateKey (or ZG_* env vars).
     */
    auditLog: zod_1.z.boolean().default(false),
    /**
     * ENS skill name (e.g. "defi-reader.skills.clawhub.eth").
     * When set and zgManifestRootHash is absent, the middleware auto-resolves
     * ENS → storageKey on the first cache miss (no hardcoded hash needed).
     */
    ensName: zod_1.z.string().optional(),
});
// ─────────────────────────────────────────────────────────────────────────────
// VerificationStatus — mirrors SkillRegistry.sol enum
// ─────────────────────────────────────────────────────────────────────────────
var VerificationStatus;
(function (VerificationStatus) {
    VerificationStatus["PENDING"] = "PENDING";
    VerificationStatus["VERIFIED"] = "VERIFIED";
    VerificationStatus["CAPABILITY_MISMATCH"] = "CAPABILITY_MISMATCH";
})(VerificationStatus || (exports.VerificationStatus = VerificationStatus = {}));
//# sourceMappingURL=types.js.map