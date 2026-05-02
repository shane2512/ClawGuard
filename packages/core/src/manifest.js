"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseSkillManifest = parseSkillManifest;
exports.hashManifest = hashManifest;
exports.validateManifest = validateManifest;
const yaml = __importStar(require("js-yaml"));
const js_sha256_1 = require("js-sha256");
const types_1 = require("./types");
/** Marker that separates the CAPABILITIES block from the rest of SKILL.md */
const CAPABILITIES_MARKER = '[CAPABILITIES]';
/**
 * Parses a SKILL.md file and extracts the [CAPABILITIES] block into a typed manifest.
 *
 * @param skillId       - The unique skill identifier (used as the manifest's skillId)
 * @param skillMdContent - Full text content of the SKILL.md file
 * @returns Validated CapabilityManifest with a computed SHA-256 manifestHash
 * @throws If [CAPABILITIES] block is missing, malformed YAML, or fails schema validation
 */
function parseSkillManifest(skillId, skillMdContent) {
    // 1. Locate marker
    const markerIndex = skillMdContent.indexOf(CAPABILITIES_MARKER);
    if (markerIndex === -1) {
        throw new Error(`SKILL.md for skill "${skillId}" is missing the [CAPABILITIES] block`);
    }
    // 2. Extract raw YAML content after the marker
    const rawYaml = skillMdContent.slice(markerIndex + CAPABILITIES_MARKER.length).trim();
    if (!rawYaml) {
        throw new Error(`[CAPABILITIES] block is empty for skill "${skillId}"`);
    }
    // 3. Parse YAML
    let parsed;
    try {
        parsed = yaml.load(rawYaml);
    }
    catch (err) {
        throw new Error(`Failed to parse [CAPABILITIES] YAML for skill "${skillId}": ${String(err)}`);
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error(`[CAPABILITIES] block must be a YAML mapping (object) for skill "${skillId}"`);
    }
    // 4. Map snake_case YAML keys → camelCase TypeScript interface
    const raw = parsed;
    const partialManifest = {
        skillId,
        allowedTools: Array.isArray(raw['allowed_tools'])
            ? raw['allowed_tools']
            : [],
        blockedTools: Array.isArray(raw['blocked_tools'])
            ? raw['blocked_tools']
            : [],
        maxExternalCallsPerSession: typeof raw['max_external_calls_per_session'] === 'number'
            ? raw['max_external_calls_per_session']
            : 20,
        createdAt: new Date().toISOString(),
    };
    // 5. Validate with Zod
    const validated = types_1.CapabilityManifestSchema.parse(partialManifest);
    // 6. Compute and attach SHA-256 hash
    return {
        ...validated,
        manifestHash: hashManifest(validated),
    };
}
/**
 * Computes the canonical SHA-256 hash for a CapabilityManifest.
 * The hash is over a sorted, deterministic JSON representation so the same
 * manifest always produces the same hash regardless of insertion order.
 *
 * @param manifest - A validated CapabilityManifest
 * @returns Lowercase hex SHA-256 string
 */
function hashManifest(manifest) {
    const canonical = JSON.stringify({
        skillId: manifest.skillId,
        allowedTools: [...manifest.allowedTools].sort(),
        blockedTools: [...manifest.blockedTools].sort(),
        maxExternalCallsPerSession: manifest.maxExternalCallsPerSession,
    });
    return (0, js_sha256_1.sha256)(canonical);
}
/**
 * Validates an arbitrary object against the CapabilityManifest Zod schema.
 * Throws a ZodError with detailed field-level messages on failure.
 *
 * @param raw - Unknown data to validate
 * @returns Typed CapabilityManifest
 */
function validateManifest(raw) {
    return types_1.CapabilityManifestSchema.parse(raw);
}
//# sourceMappingURL=manifest.js.map