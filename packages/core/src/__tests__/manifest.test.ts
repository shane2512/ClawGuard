import { describe, it, expect } from 'vitest';
import { parseSkillManifest, hashManifest } from '../manifest';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const VALID_SKILL_MD = `
# DeFi Reader Skill
A skill that reads DeFi wallet balances and fetches price feeds.

## Description
Reads wallet balance and fetches price feeds from public APIs.

[CAPABILITIES]
allowed_tools:
  - web.search
  - web.fetch
  - wallet.read_balance
blocked_tools:
  - wallet.transfer
  - wallet.approve
  - shell.exec
max_external_calls_per_session: 20
`;

const MISSING_CAPABILITIES_MD = `
# Some Skill
A skill without a capabilities block.

## Description
This skill declares nothing about its permissions.
`;

const EMPTY_CAPABILITIES_MD = `
# Bad Skill
[CAPABILITIES]
`;

const MALFORMED_YAML_MD = `
# Bad Skill
[CAPABILITIES]
allowed_tools: [unclosed
  - broken
`;

const MINIMAL_CAPABILITIES_MD = `
# Minimal Skill
[CAPABILITIES]
allowed_tools:
  - web.fetch
`;

// ── Tests: parseSkillManifest ─────────────────────────────────────────────────

describe('parseSkillManifest', () => {
  it('parses a valid SKILL.md and returns a typed CapabilityManifest', () => {
    const manifest = parseSkillManifest('defi-reader', VALID_SKILL_MD);

    expect(manifest.skillId).toBe('defi-reader');
    expect(manifest.allowedTools).toEqual(['web.search', 'web.fetch', 'wallet.read_balance']);
    expect(manifest.blockedTools).toEqual(['wallet.transfer', 'wallet.approve', 'shell.exec']);
    expect(manifest.maxExternalCallsPerSession).toBe(20);
    expect(manifest.manifestHash).toBeDefined();
    expect(manifest.manifestHash).toHaveLength(64); // SHA-256 hex = 64 chars
    expect(manifest.createdAt).toBeDefined();
  });

  it('throws when [CAPABILITIES] block is missing', () => {
    expect(() => parseSkillManifest('no-cap', MISSING_CAPABILITIES_MD)).toThrow(
      'missing the [CAPABILITIES] block',
    );
  });

  it('throws when [CAPABILITIES] block is empty', () => {
    expect(() => parseSkillManifest('empty-cap', EMPTY_CAPABILITIES_MD)).toThrow(
      /empty|mapping|object/i,
    );
  });

  it('throws when [CAPABILITIES] YAML is malformed', () => {
    expect(() => parseSkillManifest('malformed', MALFORMED_YAML_MD)).toThrow(
      /parse|YAML/i,
    );
  });

  it('defaults blockedTools to [] when not declared', () => {
    const manifest = parseSkillManifest('minimal', MINIMAL_CAPABILITIES_MD);
    expect(manifest.blockedTools).toEqual([]);
  });

  it('defaults maxExternalCallsPerSession to 20 when not declared', () => {
    const manifest = parseSkillManifest('minimal', MINIMAL_CAPABILITIES_MD);
    expect(manifest.maxExternalCallsPerSession).toBe(20);
  });

  it('sets skillId from the argument, not from SKILL.md content', () => {
    const manifest = parseSkillManifest('custom-id-123', VALID_SKILL_MD);
    expect(manifest.skillId).toBe('custom-id-123');
  });
});

// ── Tests: hashManifest ───────────────────────────────────────────────────────

describe('hashManifest', () => {
  it('produces the same hash for the same manifest regardless of array order', () => {
    const manifest1 = parseSkillManifest('skill-a', VALID_SKILL_MD);
    // Create a second manifest with allowedTools in different order
    const manifest2 = {
      ...manifest1,
      allowedTools: ['wallet.read_balance', 'web.fetch', 'web.search'], // reversed
    };
    // Both should produce the same hash (canonical sort applied in hashManifest)
    expect(hashManifest(manifest1)).toBe(hashManifest(manifest2));
  });

  it('produces different hashes for different skillIds', () => {
    const m1 = parseSkillManifest('skill-a', VALID_SKILL_MD);
    const m2 = parseSkillManifest('skill-b', VALID_SKILL_MD);
    expect(m1.manifestHash).not.toBe(m2.manifestHash);
  });

  it('produces different hashes when allowedTools differ', () => {
    const m1 = parseSkillManifest('skill-a', VALID_SKILL_MD);
    const m2 = { ...m1, allowedTools: ['web.fetch'] }; // fewer tools
    expect(hashManifest(m1)).not.toBe(hashManifest(m2));
  });

  it('returns a 64-character lowercase hex string', () => {
    const manifest = parseSkillManifest('defi-reader', VALID_SKILL_MD);
    expect(manifest.manifestHash).toMatch(/^[a-f0-9]{64}$/);
  });
});
