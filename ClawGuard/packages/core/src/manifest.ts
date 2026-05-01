import * as yaml from 'js-yaml';
import { sha256 } from 'js-sha256';
import { CapabilityManifest, CapabilityManifestSchema } from './types';

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
export function parseSkillManifest(
  skillId: string,
  skillMdContent: string,
): CapabilityManifest {
  // 1. Locate marker
  const markerIndex = skillMdContent.indexOf(CAPABILITIES_MARKER);
  if (markerIndex === -1) {
    throw new Error(
      `SKILL.md for skill "${skillId}" is missing the [CAPABILITIES] block`,
    );
  }

  // 2. Extract raw YAML content after the marker
  const rawYaml = skillMdContent.slice(markerIndex + CAPABILITIES_MARKER.length).trim();
  if (!rawYaml) {
    throw new Error(`[CAPABILITIES] block is empty for skill "${skillId}"`);
  }

  // 3. Parse YAML
  let parsed: unknown;
  try {
    parsed = yaml.load(rawYaml);
  } catch (err) {
    throw new Error(
      `Failed to parse [CAPABILITIES] YAML for skill "${skillId}": ${String(err)}`,
    );
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(
      `[CAPABILITIES] block must be a YAML mapping (object) for skill "${skillId}"`,
    );
  }

  // 4. Map snake_case YAML keys → camelCase TypeScript interface
  const raw = parsed as Record<string, unknown>;
  const partialManifest = {
    skillId,
    allowedTools: Array.isArray(raw['allowed_tools'])
      ? (raw['allowed_tools'] as string[])
      : [],
    blockedTools: Array.isArray(raw['blocked_tools'])
      ? (raw['blocked_tools'] as string[])
      : [],
    maxExternalCallsPerSession:
      typeof raw['max_external_calls_per_session'] === 'number'
        ? (raw['max_external_calls_per_session'] as number)
        : 20,
    createdAt: new Date().toISOString(),
  };

  // 5. Validate with Zod
  const validated = CapabilityManifestSchema.parse(partialManifest);

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
export function hashManifest(manifest: CapabilityManifest): string {
  const canonical = JSON.stringify({
    skillId: manifest.skillId,
    allowedTools: [...manifest.allowedTools].sort(),
    blockedTools: [...manifest.blockedTools].sort(),
    maxExternalCallsPerSession: manifest.maxExternalCallsPerSession,
  });
  return sha256(canonical);
}

/**
 * Validates an arbitrary object against the CapabilityManifest Zod schema.
 * Throws a ZodError with detailed field-level messages on failure.
 *
 * @param raw - Unknown data to validate
 * @returns Typed CapabilityManifest
 */
export function validateManifest(raw: unknown): CapabilityManifest {
  return CapabilityManifestSchema.parse(raw);
}
