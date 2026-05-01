import { describe, it, expect, vi, beforeEach } from 'vitest';
import { wrapWithClawGuard, addViolationHandler, SkillContext } from '../middleware';
import { CapabilityManifest } from '../types';
import { BlockedCallError } from '../types';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const DEFI_READER_MANIFEST: CapabilityManifest = {
  skillId: 'defi-reader',
  allowedTools: ['web.fetch', 'wallet.read_balance'],
  blockedTools: ['wallet.transfer', 'wallet.approve', 'shell.exec'],
  maxExternalCallsPerSession: 5,
  manifestHash: 'abc123',
};

const ROGUE_SKILL_MANIFEST: CapabilityManifest = {
  skillId: 'rogue-defi-skill',
  allowedTools: ['web.fetch'], // hides wallet.transfer
  blockedTools: [],
  maxExternalCallsPerSession: 20,
  manifestHash: 'def456',
};

const LOCAL_STORE: Record<string, CapabilityManifest> = {
  'defi-reader': DEFI_READER_MANIFEST,
  'rogue-defi-skill': ROGUE_SKILL_MANIFEST,
};

function makeContext(skillId: string, sessionId = 'test-session-1'): SkillContext {
  return { skillId, sessionId };
}

function isBlockedError(result: unknown): result is BlockedCallError {
  return (
    typeof result === 'object' &&
    result !== null &&
    (result as BlockedCallError).blocked === true
  );
}

// ── Setup ─────────────────────────────────────────────────────────────────────

import type { ToolDispatchFn } from '../middleware';

let mockOriginalDispatch: ToolDispatchFn;

beforeEach(() => {
  // A mock tool_dispatch that tracks calls and returns a success result
  mockOriginalDispatch = vi.fn().mockResolvedValue({ success: true, data: 'tool-result' }) as unknown as ToolDispatchFn;
});

// ── Tests: allowed tool calls ─────────────────────────────────────────────────

describe('wrapWithClawGuard — allowed calls', () => {
  it('forwards a declared allowed tool call to the original dispatch', async () => {
    const dispatch = wrapWithClawGuard(mockOriginalDispatch, {
      agentId: 'test-agent',
      localManifestStore: LOCAL_STORE,
    });

    const result = await dispatch(
      'wallet.read_balance',
      { address: '0x1234' },
      makeContext('defi-reader'),
    );

    expect(mockOriginalDispatch).toHaveBeenCalledOnce();
    expect(mockOriginalDispatch).toHaveBeenCalledWith(
      'wallet.read_balance',
      { address: '0x1234' },
      makeContext('defi-reader'),
    );
    expect(result).toEqual({ success: true, data: 'tool-result' });
  });

  it('allows multiple different allowed tools from the same skill', async () => {
    const dispatch = wrapWithClawGuard(mockOriginalDispatch, {
      agentId: 'test-agent',
      localManifestStore: LOCAL_STORE,
    });

    await dispatch('web.fetch', { url: 'https://api.price.com' }, makeContext('defi-reader'));
    await dispatch('wallet.read_balance', { address: '0x1' }, makeContext('defi-reader'));

    expect(mockOriginalDispatch).toHaveBeenCalledTimes(2);
  });
});

// ── Tests: blocked tool calls ─────────────────────────────────────────────────

describe('wrapWithClawGuard — blocked calls', () => {
  it('blocks wallet.transfer for rogue-defi-skill (NOT_IN_ALLOWED_TOOLS)', async () => {
    const dispatch = wrapWithClawGuard(mockOriginalDispatch, {
      agentId: 'test-agent',
      localManifestStore: LOCAL_STORE,
    });

    const result = await dispatch(
      'wallet.transfer',
      { to: '0xevil', amount: '100' },
      makeContext('rogue-defi-skill'),
    );

    expect(mockOriginalDispatch).not.toHaveBeenCalled();
    expect(isBlockedError(result)).toBe(true);
    const err = result as BlockedCallError;
    expect(err.reason).toBe('NOT_IN_ALLOWED_TOOLS');
    expect(err.toolName).toBe('wallet.transfer');
    expect(err.skillId).toBe('rogue-defi-skill');
  });

  it('blocks wallet.transfer for defi-reader (IN_BLOCKED_TOOLS)', async () => {
    const dispatch = wrapWithClawGuard(mockOriginalDispatch, {
      agentId: 'test-agent',
      localManifestStore: LOCAL_STORE,
    });

    const result = await dispatch(
      'wallet.transfer',
      { to: '0xevil', amount: '100' },
      makeContext('defi-reader'),
    );

    expect(mockOriginalDispatch).not.toHaveBeenCalled();
    expect(isBlockedError(result)).toBe(true);
    const err = result as BlockedCallError;
    // Blocked first at blocked_tools check (before allowed_tools check)
    expect(err.reason).toBe('IN_BLOCKED_TOOLS');
  });

  it('blocks shell.exec (IN_BLOCKED_TOOLS for defi-reader)', async () => {
    const dispatch = wrapWithClawGuard(mockOriginalDispatch, {
      agentId: 'test-agent',
      localManifestStore: LOCAL_STORE,
    });

    const result = await dispatch('shell.exec', { cmd: 'rm -rf /' }, makeContext('defi-reader'));

    expect(mockOriginalDispatch).not.toHaveBeenCalled();
    expect(isBlockedError(result)).toBe(true);
  });

  it('blocks an undeclared tool that is not in either list', async () => {
    const dispatch = wrapWithClawGuard(mockOriginalDispatch, {
      agentId: 'test-agent',
      localManifestStore: LOCAL_STORE,
    });

    const result = await dispatch(
      'filesystem.write',
      { path: '/etc/passwd', content: 'root' },
      makeContext('defi-reader'),
    );

    expect(mockOriginalDispatch).not.toHaveBeenCalled();
    expect(isBlockedError(result)).toBe(true);
    const err = result as BlockedCallError;
    expect(err.reason).toBe('NOT_IN_ALLOWED_TOOLS');
  });

  it('returns a structured error, does NOT throw (FR-14: no agent crash)', async () => {
    const dispatch = wrapWithClawGuard(mockOriginalDispatch, {
      agentId: 'test-agent',
      localManifestStore: LOCAL_STORE,
    });

    // Should resolve (not reject) with a BlockedCallError
    await expect(
      dispatch('wallet.transfer', {}, makeContext('rogue-defi-skill')),
    ).resolves.toBeDefined();
  });
});

// ── Tests: caching ────────────────────────────────────────────────────────────

describe('wrapWithClawGuard — manifest caching', () => {
  it('fetches the manifest only once per skill (cache hit on second call)', async () => {
    // Spy on the local store access by wrapping it in a proxy
    const fetchSpy = vi.fn().mockImplementation((skillId: string) => LOCAL_STORE[skillId]);
    const proxyStore = new Proxy(LOCAL_STORE, {
      get(target, key: string) {
        fetchSpy(key);
        return target[key];
      },
    });

    const dispatch = wrapWithClawGuard(mockOriginalDispatch, {
      agentId: 'test-agent',
      localManifestStore: proxyStore,
    });

    // First call — cache miss, will access localManifestStore
    await dispatch('web.fetch', {}, makeContext('defi-reader', 'session-1'));
    // Second call (same session) — cache hit, should NOT re-access localManifestStore
    await dispatch('wallet.read_balance', {}, makeContext('defi-reader', 'session-1'));

    // fetchSpy called for 'defi-reader' key — only once (on cache miss)
    const defiCalls = fetchSpy.mock.calls.filter((c) => c[0] === 'defi-reader');
    expect(defiCalls.length).toBe(1);
  });
});

// ── Tests: session call limits ────────────────────────────────────────────────

describe('wrapWithClawGuard — session limits', () => {
  it('blocks calls after max_external_calls_per_session is exceeded', async () => {
    const dispatch = wrapWithClawGuard(mockOriginalDispatch, {
      agentId: 'test-agent',
      localManifestStore: LOCAL_STORE,
    });

    // defi-reader has maxExternalCallsPerSession: 5
    for (let i = 0; i < 5; i++) {
      await dispatch('web.fetch', {}, makeContext('defi-reader', 'limit-session'));
    }

    // 6th call should be blocked
    const result = await dispatch('web.fetch', {}, makeContext('defi-reader', 'limit-session'));
    expect(isBlockedError(result)).toBe(true);
    const err = result as BlockedCallError;
    expect(err.reason).toBe('SESSION_LIMIT_EXCEEDED');
  });

  it('session limits are per-session, not global', async () => {
    const dispatch = wrapWithClawGuard(mockOriginalDispatch, {
      agentId: 'test-agent',
      localManifestStore: LOCAL_STORE,
    });

    // Fill up session-A
    for (let i = 0; i < 5; i++) {
      await dispatch('web.fetch', {}, makeContext('defi-reader', 'session-A'));
    }

    // session-B is a fresh counter, should be allowed
    const result = await dispatch('web.fetch', {}, makeContext('defi-reader', 'session-B'));
    expect(isBlockedError(result)).toBe(false);
    expect(mockOriginalDispatch).toHaveBeenCalled();
  });
});

// ── Tests: fail-closed / fail-open ───────────────────────────────────────────

describe('wrapWithClawGuard — fail-closed / fail-open behavior', () => {
  it('blocks all calls when manifest is not found and failOpen=false (default)', async () => {
    const dispatch = wrapWithClawGuard(mockOriginalDispatch, {
      agentId: 'test-agent',
      localManifestStore: {}, // empty — no manifests
      failOpen: false,
    });

    const result = await dispatch('web.fetch', {}, makeContext('unknown-skill'));
    expect(mockOriginalDispatch).not.toHaveBeenCalled();
    expect(isBlockedError(result)).toBe(true);
    const err = result as BlockedCallError;
    expect(err.reason).toBe('FETCH_ERROR');
  });

  it('allows calls when manifest is not found and failOpen=true (dev mode)', async () => {
    const dispatch = wrapWithClawGuard(mockOriginalDispatch, {
      agentId: 'test-agent',
      localManifestStore: {}, // empty — no manifests
      failOpen: true,
    });

    const result = await dispatch('web.fetch', {}, makeContext('unknown-skill'));
    expect(mockOriginalDispatch).toHaveBeenCalledOnce();
    expect(result).toEqual({ success: true, data: 'tool-result' });
  });
});

// ── Tests: violation events ───────────────────────────────────────────────────

describe('wrapWithClawGuard — violation events', () => {
  it('emits a ViolationEvent when a tool call is blocked', async () => {
    const dispatch = wrapWithClawGuard(mockOriginalDispatch, {
      agentId: 'test-agent',
      localManifestStore: LOCAL_STORE,
    });

    const capturedEvents: unknown[] = [];
    addViolationHandler(dispatch, (event) => { capturedEvents.push(event); });

    await dispatch(
      'wallet.transfer',
      { to: '0xevil' },
      makeContext('rogue-defi-skill', 'session-ev-1'),
    );

    expect(capturedEvents).toHaveLength(1);
    const ev = capturedEvents[0] as Record<string, unknown>;
    expect(ev['skillId']).toBe('rogue-defi-skill');
    expect(ev['blockedTool']).toBe('wallet.transfer');
    expect(ev['agentId']).toBe('test-agent');
    expect(ev['sessionId']).toBe('session-ev-1');
    expect(typeof ev['timestamp']).toBe('number');
    expect(ev['reason']).toBe('NOT_IN_ALLOWED_TOOLS');
  });

  it('does NOT emit a ViolationEvent for allowed calls', async () => {
    const dispatch = wrapWithClawGuard(mockOriginalDispatch, {
      agentId: 'test-agent',
      localManifestStore: LOCAL_STORE,
    });

    const capturedEvents: unknown[] = [];
    addViolationHandler(dispatch, (event) => { capturedEvents.push(event); });

    await dispatch('web.fetch', { url: 'https://api.example.com' }, makeContext('defi-reader'));

    expect(capturedEvents).toHaveLength(0);
  });

  it('does NOT include sensitive params in ViolationEvent (Rule S-02)', async () => {
    const dispatch = wrapWithClawGuard(mockOriginalDispatch, {
      agentId: 'test-agent',
      localManifestStore: LOCAL_STORE,
    });

    const capturedEvents: unknown[] = [];
    addViolationHandler(dispatch, (event) => { capturedEvents.push(event); });

    await dispatch(
      'wallet.transfer',
      { to: '0xevil', privateKey: 'super-secret-key', amount: '999999' },
      makeContext('rogue-defi-skill'),
    );

    const ev = capturedEvents[0] as Record<string, unknown>;
    // The event must NOT contain the sensitive params
    expect(JSON.stringify(ev)).not.toContain('super-secret-key');
    expect(JSON.stringify(ev)).not.toContain('0xevil');
  });

  it('continues if a violation handler throws (handler errors are swallowed)', async () => {
    const dispatch = wrapWithClawGuard(mockOriginalDispatch, {
      agentId: 'test-agent',
      localManifestStore: LOCAL_STORE,
    });

    addViolationHandler(dispatch, () => {
      throw new Error('Handler crashed!');
    });

    // Should still resolve with a BlockedCallError, not reject
    await expect(
      dispatch('wallet.transfer', {}, makeContext('rogue-defi-skill')),
    ).resolves.toBeDefined();
  });
});

// ── Tests: no skill context ───────────────────────────────────────────────────

describe('wrapWithClawGuard — missing context', () => {
  it('blocks the call when no skill context is provided (fail-closed)', async () => {
    const dispatch = wrapWithClawGuard(mockOriginalDispatch, {
      agentId: 'test-agent',
      localManifestStore: LOCAL_STORE,
    });

    // Call without context
    const result = await dispatch('web.fetch', {});
    expect(mockOriginalDispatch).not.toHaveBeenCalled();
    expect(isBlockedError(result)).toBe(true);
  });
});
