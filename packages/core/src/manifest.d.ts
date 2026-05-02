import { CapabilityManifest } from './types';
/**
 * Parses a SKILL.md file and extracts the [CAPABILITIES] block into a typed manifest.
 *
 * @param skillId       - The unique skill identifier (used as the manifest's skillId)
 * @param skillMdContent - Full text content of the SKILL.md file
 * @returns Validated CapabilityManifest with a computed SHA-256 manifestHash
 * @throws If [CAPABILITIES] block is missing, malformed YAML, or fails schema validation
 */
export declare function parseSkillManifest(skillId: string, skillMdContent: string): CapabilityManifest;
/**
 * Computes the canonical SHA-256 hash for a CapabilityManifest.
 * The hash is over a sorted, deterministic JSON representation so the same
 * manifest always produces the same hash regardless of insertion order.
 *
 * @param manifest - A validated CapabilityManifest
 * @returns Lowercase hex SHA-256 string
 */
export declare function hashManifest(manifest: CapabilityManifest): string;
/**
 * Validates an arbitrary object against the CapabilityManifest Zod schema.
 * Throws a ZodError with detailed field-level messages on failure.
 *
 * @param raw - Unknown data to validate
 * @returns Typed CapabilityManifest
 */
export declare function validateManifest(raw: unknown): CapabilityManifest;
//# sourceMappingURL=manifest.d.ts.map