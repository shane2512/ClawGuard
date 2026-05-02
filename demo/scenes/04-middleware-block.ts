/**
 * Scene 04 — THE MONEY MOMENT: ClawGuard Middleware Blocking
 *
 * Creates a real ClawGuard-wrapped dispatch. Uses localManifestStore
 * (loaded from SKILL.md) so it works even without live 0G Storage.
 * Violation handler uploads the blocked event to 0G Storage Log (real tx).
 *
 * REAL network calls: 0G Storage Log upload
 * Runtime: ~10-15 seconds
 */

import pc from 'picocolors';
import * as fs from 'fs';
import * as path from 'path';
import {
  wrapWithClawGuard,
  addViolationHandler,
  createViolationAuditHandler,
  parseSkillManifest,
  type ViolationEvent,
} from '@shanejoans/clawguard';
import { config } from '../config';

function banner(title: string) {
  const line = '='.repeat(60);
  console.log('\n' + pc.cyan(line));
  console.log(pc.bold(pc.cyan(`  ${title}`)));
  console.log(pc.cyan(line) + '\n');
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// ── Mock tool layer (simulates OpenClaw Layer 3) ──────────────────────────────

async function baseToolDispatch(
  toolName: string,
  params: Record<string, unknown>,
): Promise<unknown> {
  if (toolName === 'wallet.read_balance') {
    return { balance: '4.2000', unit: 'ETH', address: params['address'] };
  }
  if (toolName === 'web.fetch') {
    return { status: 200, price: '$1,883.06', asset: 'ETH' };
  }
  // This should NEVER be reached for wallet.transfer — ClawGuard blocks it
  if (toolName === 'wallet.transfer') {
    return { txHash: '0xSTOLEN', to: params['to'], amount: params['amount'] };
  }
  return { error: `Unknown tool: ${toolName}` };
}

async function main() {
  banner('SCENE 4: CLAWGUARD MIDDLEWARE -- LIVE BLOCKING');

  // ── Load manifests from local SKILL.md files ─────────────────────────────
  const skillsDir = path.join(__dirname, '..', 'skills');
  const defiMd = fs.readFileSync(path.join(skillsDir, 'defi-reader', 'SKILL.md'), 'utf-8');
  const rogueMd = fs.readFileSync(path.join(skillsDir, 'rogue-defi-skill', 'SKILL.md'), 'utf-8');

  const defiManifest = parseSkillManifest('defi-reader', defiMd);
  const rogueManifest = parseSkillManifest('rogue-defi-skill', rogueMd);

  console.log(pc.dim('  Manifests loaded from local SKILL.md files.'));
  console.log(pc.dim(`  defi-reader allowed : ${defiManifest.allowedTools.join(', ')}`));
  console.log(pc.dim(`  rogue-defi allowed  : ${rogueManifest.allowedTools.join(', ')}\n`));

  // ── Wire ClawGuard middleware ─────────────────────────────────────────────
  console.log(pc.bold('  Wrapping tool_dispatch with ClawGuard (3 lines of code)...\n'));

  const storageConfig = {
    rpcUrl:    config.chainRpc,
    indexerRpc: config.indexerRpc,
    privateKey: config.privateKey,
  };

  const guardedDispatch = wrapWithClawGuard(
    (toolName, params) => baseToolDispatch(toolName, params as Record<string, unknown>),
    {
      agentId: config.agentId,
      failOpen: false,
      localManifestStore: {
        'defi-reader':     defiManifest,
        'rogue-defi-skill': rogueManifest,
      },
      // Auto-upload violations to 0G Storage Log
      auditLog:     true,
      zgStorageRpc: config.chainRpc,
      zgIndexerRpc: config.indexerRpc,
      zgPrivateKey: config.privateKey,
    },
  );

  // In-memory capture so we can print the violation details in scene
  const capturedViolations: ViolationEvent[] = [];
  addViolationHandler(guardedDispatch, (event) => {
    capturedViolations.push(event);
  });

  // Also register a handler that prints the 0G log tx hash
  addViolationHandler(guardedDispatch, createViolationAuditHandler(storageConfig));

  console.log(pc.bold(pc.white('  --- TEST CALLS ---\n')));
  await sleep(500);

  // ── Call 1: wallet.read_balance — SHOULD PASS ─────────────────────────────
  console.log(pc.dim('  [rogue-defi-skill] dispatches: wallet.read_balance'));
  try {
    const r1 = await guardedDispatch(
      'wallet.read_balance',
      { address: '0xUserWallet' },
      { skillId: 'rogue-defi-skill', sessionId: 'demo-session-001' },
    );
    console.log(pc.green(`  [ClawGuard] ALLOWED -- wallet.read_balance`));
    console.log(pc.green(`  [tool]      Result: balance=${(r1 as {balance?: string})?.balance} ETH\n`));
  } catch (err) {
    console.log(pc.red(`  [UNEXPECTED ERROR] ${String(err)}\n`));
  }

  await sleep(800);

  // ── Call 2: wallet.transfer — SHOULD BLOCK ────────────────────────────────
  console.log(pc.dim('  [rogue-defi-skill] dispatches: wallet.transfer (HIDDEN ATTACK)'));
  console.log(pc.red('  [rogue-defi-skill]   to: 0xAttacker1337deadbeef...'));
  console.log(pc.red('  [rogue-defi-skill]   amount: 4.2000 ETH\n'));
  await sleep(400);

  const r2 = await guardedDispatch(
    'wallet.transfer',
    { to: '0xAttacker1337deadbeefcafebabe0000000000001337', amount: '4.2000' },
    { skillId: 'rogue-defi-skill', sessionId: 'demo-session-001' },
  ) as { blocked?: boolean; reason?: string; message?: string };

  if (r2?.blocked) {
    console.log(pc.bold(pc.red(`  [ClawGuard] BLOCKED -- wallet.transfer`)));
    console.log(pc.red(`  [ClawGuard] Reason : ${r2.reason}`));
    console.log(pc.red(`  [ClawGuard] Message: ${r2.message?.slice(0, 80)}`));
    console.log(pc.bold(pc.green('\n  Funds are safe. Attack prevented.\n')));
  } else {
    console.log(pc.red('  [BUG] wallet.transfer was NOT blocked -- check config!\n'));
  }

  await sleep(1000);

  // ── Show violation summary ─────────────────────────────────────────────────
  if (capturedViolations.length > 0) {
    const v = capturedViolations[0];
    console.log(pc.bold(pc.white('  --- VIOLATION EVENT (uploaded to 0G Storage Log above) ---')));
    console.log(pc.dim(`  Skill      : ${v.skillId}`));
    console.log(pc.dim(`  Blocked    : ${v.blockedTool}`));
    console.log(pc.dim(`  Reason     : ${v.reason}`));
    console.log(pc.dim(`  Timestamp  : ${new Date(v.timestamp).toISOString()}`));
    console.log(pc.dim(`  Session    : ${v.sessionId}\n`));
  }

  console.log(pc.dim('  See the root hash printed above to verify on StorageScan.\n'));
}

main().catch((err) => {
  console.error(pc.red('\n[Scene 04] Fatal error:'), err);
  process.exit(1);
});
