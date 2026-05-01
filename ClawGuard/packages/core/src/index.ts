/**
 * @clawguard/core — Public API
 *
 * The three primitives:
 *  1. parseSkillManifest / hashManifest — CapabilityManifest parsing & hashing
 *  2. wrapWithClawGuard               — Middleware wrapping tool_dispatch
 *  3. addViolationHandler             — Pipe violation events to external sinks
 */

// Types & schemas
export type {
  CapabilityManifest,
  ViolationEvent,
  ClawGuardConfig,
  BlockedCallError,
  ToolCallRequest,
} from './types';
export {
  CapabilityManifestSchema,
  ViolationEventSchema,
  ClawGuardConfigSchema,
  VerificationStatus,
} from './types';

// Manifest utilities
export { parseSkillManifest, hashManifest, validateManifest } from './manifest';

// Cache
export { createManifestCache } from './cache';

// Storage (Phase 2)
export type { ZGStorageConfig } from './storage';
export { ZGStorageClient, createStorageClientFromEnv } from './storage';

// Middleware
export type { ToolDispatchFn, SkillContext, ViolationHandler } from './middleware';
export { wrapWithClawGuard, addViolationHandler } from './middleware';

// ENS Integration (Phase 3)
export type { SkillEnsRecord, RegisterSkillEnsOptions } from './ens';
export {
  ENS_KEYS,
  skillToEnsName,
  resolveSkillEns,
  getSkillStorageKey,
  registerSkillEns,
  revokeSkillEns,
  getEnsConfigFromEnv,
} from './ens';
