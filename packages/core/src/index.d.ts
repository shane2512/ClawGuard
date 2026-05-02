/**
 * @clawguard/core — Public API
 *
 * The three primitives:
 *  1. parseSkillManifest / hashManifest — CapabilityManifest parsing & hashing
 *  2. wrapWithClawGuard               — Middleware wrapping tool_dispatch
 *  3. addViolationHandler             — Pipe violation events to external sinks
 */
export type { CapabilityManifest, ViolationEvent, ClawGuardConfig, BlockedCallError, ToolCallRequest, } from './types';
export { CapabilityManifestSchema, ViolationEventSchema, ClawGuardConfigSchema, VerificationStatus, } from './types';
export { parseSkillManifest, hashManifest, validateManifest } from './manifest';
export { createManifestCache } from './cache';
export type { ZGStorageConfig } from './storage';
export { ZGStorageClient, createStorageClientFromEnv, createViolationAuditHandler } from './storage';
export type { ToolDispatchFn, SkillContext, ViolationHandler } from './middleware';
export { wrapWithClawGuard, addViolationHandler } from './middleware';
export type { SkillEnsRecord, RegisterSkillEnsOptions } from './ens';
export { ENS_KEYS, skillToEnsName, resolveSkillEns, getSkillStorageKey, registerSkillEns, revokeSkillEns, getEnsConfigFromEnv, } from './ens';
//# sourceMappingURL=index.d.ts.map