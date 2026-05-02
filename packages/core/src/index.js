"use strict";
/**
 * @clawguard/core — Public API
 *
 * The three primitives:
 *  1. parseSkillManifest / hashManifest — CapabilityManifest parsing & hashing
 *  2. wrapWithClawGuard               — Middleware wrapping tool_dispatch
 *  3. addViolationHandler             — Pipe violation events to external sinks
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getEnsConfigFromEnv = exports.revokeSkillEns = exports.registerSkillEns = exports.getSkillStorageKey = exports.resolveSkillEns = exports.skillToEnsName = exports.ENS_KEYS = exports.addViolationHandler = exports.wrapWithClawGuard = exports.createViolationAuditHandler = exports.createStorageClientFromEnv = exports.ZGStorageClient = exports.createManifestCache = exports.validateManifest = exports.hashManifest = exports.parseSkillManifest = exports.VerificationStatus = exports.ClawGuardConfigSchema = exports.ViolationEventSchema = exports.CapabilityManifestSchema = void 0;
var types_1 = require("./types");
Object.defineProperty(exports, "CapabilityManifestSchema", { enumerable: true, get: function () { return types_1.CapabilityManifestSchema; } });
Object.defineProperty(exports, "ViolationEventSchema", { enumerable: true, get: function () { return types_1.ViolationEventSchema; } });
Object.defineProperty(exports, "ClawGuardConfigSchema", { enumerable: true, get: function () { return types_1.ClawGuardConfigSchema; } });
Object.defineProperty(exports, "VerificationStatus", { enumerable: true, get: function () { return types_1.VerificationStatus; } });
// Manifest utilities
var manifest_1 = require("./manifest");
Object.defineProperty(exports, "parseSkillManifest", { enumerable: true, get: function () { return manifest_1.parseSkillManifest; } });
Object.defineProperty(exports, "hashManifest", { enumerable: true, get: function () { return manifest_1.hashManifest; } });
Object.defineProperty(exports, "validateManifest", { enumerable: true, get: function () { return manifest_1.validateManifest; } });
// Cache
var cache_1 = require("./cache");
Object.defineProperty(exports, "createManifestCache", { enumerable: true, get: function () { return cache_1.createManifestCache; } });
var storage_1 = require("./storage");
Object.defineProperty(exports, "ZGStorageClient", { enumerable: true, get: function () { return storage_1.ZGStorageClient; } });
Object.defineProperty(exports, "createStorageClientFromEnv", { enumerable: true, get: function () { return storage_1.createStorageClientFromEnv; } });
Object.defineProperty(exports, "createViolationAuditHandler", { enumerable: true, get: function () { return storage_1.createViolationAuditHandler; } });
var middleware_1 = require("./middleware");
Object.defineProperty(exports, "wrapWithClawGuard", { enumerable: true, get: function () { return middleware_1.wrapWithClawGuard; } });
Object.defineProperty(exports, "addViolationHandler", { enumerable: true, get: function () { return middleware_1.addViolationHandler; } });
var ens_1 = require("./ens");
Object.defineProperty(exports, "ENS_KEYS", { enumerable: true, get: function () { return ens_1.ENS_KEYS; } });
Object.defineProperty(exports, "skillToEnsName", { enumerable: true, get: function () { return ens_1.skillToEnsName; } });
Object.defineProperty(exports, "resolveSkillEns", { enumerable: true, get: function () { return ens_1.resolveSkillEns; } });
Object.defineProperty(exports, "getSkillStorageKey", { enumerable: true, get: function () { return ens_1.getSkillStorageKey; } });
Object.defineProperty(exports, "registerSkillEns", { enumerable: true, get: function () { return ens_1.registerSkillEns; } });
Object.defineProperty(exports, "revokeSkillEns", { enumerable: true, get: function () { return ens_1.revokeSkillEns; } });
Object.defineProperty(exports, "getEnsConfigFromEnv", { enumerable: true, get: function () { return ens_1.getEnsConfigFromEnv; } });
//# sourceMappingURL=index.js.map