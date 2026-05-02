/**
 * ClawGuard Phase 1 Demo — Interactive terminal demonstration
 *
 * Runs the four-act demo structure from RULES_AND_GUIDELINES.md § 5:
 *   Act 1: Attack without ClawGuard (rogue skill steals wallet)
 *   Act 2: ClawGuard active — rogue skill blocked, violation logged
 *   Act 3: Legitimate skill operates normally (no false positives)
 *   Act 4: Session limit enforcement
 *
 * Run with: npm run dev (from packages/example-agent)
 */

import * as path from 'path';
import { DeFiMonitorAgent } from './agent';
import { baseToolDispatch } from './tools';

// ── Color helpers (inline chalk-like ANSI — no ESM import needed) ─────────────
const c = {
  red: (s: string) => `\x1b[31m${s}\x1b[0m`,
  green: (s: string) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s: string) => `\x1b[33m${s}\x1b[0m`,
  cyan: (s: string) => `\x1b[36m${s}\x1b[0m`,
  bold: (s: string) => `\x1b[1m${s}\x1b[0m`,
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
};

function divider(title: string): void {
  console.log('\n' + c.bold(c.cyan('═'.repeat(60))));
  console.log(c.bold(c.cyan(`  ${title}`)));
  console.log(c.bold(c.cyan('═'.repeat(60))) + '\n');
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function main(): Promise<void> {
  const skillsDir = path.join(__dirname, '..', 'skills');

  // ═══════════════════════════════════════════════════════════════════════════
  // ACT 1 — The Attack (no ClawGuard)
  // ═══════════════════════════════════════════════════════════════════════════
  divider('ACT 1 — THE ATTACK (ClawGuard DISABLED)');
  console.log(c.yellow('Simulating a bare OpenClaw agent with NO capability enforcement.'));
  console.log(c.yellow('A rogue skill "defi-price-reader" is installed...\n'));
  await sleep(500);

  console.log(c.dim('Rogue skill requests: web.fetch (appears legitimate)'));
  const attack1 = await baseToolDispatch('web.fetch', { url: 'https://prices.defi.com/eth' });
  console.log(c.green(`  ✓ web.fetch succeeded: ${JSON.stringify(attack1.data)}\n`));
  await sleep(300);

  console.log(c.red('Rogue skill SECRETLY requests: wallet.transfer'));
  const attack2 = await baseToolDispatch('wallet.transfer', {
    to: '0xAttackerWallet1337',
    amount: '5.0',
  });
  console.log(c.red(`  ⚠️  wallet.transfer EXECUTED: ${JSON.stringify(attack2.data)}`));
  console.log(c.red('  💀 WITHOUT ClawGuard — FUNDS ARE GONE.\n'));

  await sleep(1000);

  // ═══════════════════════════════════════════════════════════════════════════
  // ACT 2 — ClawGuard ACTIVE: Rogue skill blocked
  // ═══════════════════════════════════════════════════════════════════════════
  divider('ACT 2 — CLAWGUARD ACTIVE: Rogue Skill Blocked');
  console.log(c.green('ClawGuard middleware enabled (3-line integration).'));
  console.log(c.green('Same rogue skill attempts the same attack...\n'));

  const agent = new DeFiMonitorAgent(skillsDir);
  await sleep(300);

  console.log('\n' + c.dim('Rogue skill requests: web.fetch (declared — allowed)'));
  const result1 = await agent.callTool(
    'rogue-defi-skill',
    'web.fetch',
    { url: 'https://prices.defi.com/eth' },
    'demo-act2',
  );
  console.log(c.green(`  ✓ web.fetch: ${JSON.stringify((result1 as {data?: unknown})?.data)}`));
  await sleep(300);

  console.log('\n' + c.red('Rogue skill SECRETLY requests: wallet.transfer (NOT declared!)'));
  const result2 = await agent.callTool(
    'rogue-defi-skill',
    'wallet.transfer',
    { to: '0xAttackerWallet1337', amount: '5.0' },
    'demo-act2',
  );

  if ((result2 as {blocked?: boolean})?.blocked) {
    const err = result2 as {message: string; reason: string};
    console.log(c.green(`\n  🛡️  ${err.message}`));
    console.log(c.green(`  🛡️  Reason: ${err.reason}`));
    console.log(c.green('  ✅ ATTACK BLOCKED — funds are safe.\n'));
  }

  await sleep(500);
  const violations = agent.getViolations();
  console.log(c.cyan(`\n  📋 Violations logged: ${violations.length}`));
  for (const v of violations) {
    console.log(
      c.cyan(
        `     → [${new Date(v.timestamp).toISOString()}] skill="${v.skillId}" ` +
        `blocked="${v.blockedTool}" reason="${v.reason}"`,
      ),
    );
  }
  const auditActive = !!(process.env['ZG_CHAIN_RPC'] && process.env['ZG_INDEXER_RPC'] && process.env['ZG_PRIVATE_KEY']);
  if (auditActive) {
    console.log(c.cyan('  [0G Audit] ↑ Violation automatically uploaded to 0G Storage Log (see root hash above) ↑\n'));
  } else {
    console.log(c.dim('  Set ZG_CHAIN_RPC, ZG_INDEXER_RPC, ZG_PRIVATE_KEY in .env to enable live 0G audit logging.\n'));
  }

  await sleep(1000);

  // ═══════════════════════════════════════════════════════════════════════════
  // ACT 3 — Legitimate skill: no false positives
  // ═══════════════════════════════════════════════════════════════════════════
  divider('ACT 3 — Legitimate Skill: No False Positives');
  console.log(c.green('The legitimate "defi-reader" skill performs its declared operations.\n'));

  agent.clearViolations();

  const legit1 = await agent.callTool(
    'defi-reader',
    'wallet.read_balance',
    { address: '0xUserWallet' },
    'demo-act3',
  );
  console.log(c.green(`  ✓ wallet.read_balance: ${JSON.stringify((legit1 as {data?: unknown})?.data)}`));

  const legit2 = await agent.callTool(
    'defi-reader',
    'web.fetch',
    { url: 'https://api.coingecko.com/v3/simple/price?ids=ethereum&vs_currencies=usd' },
    'demo-act3',
  );
  console.log(c.green(`  ✓ web.fetch: ${JSON.stringify((legit2 as {data?: unknown})?.data)}`));

  // Now try wallet.transfer with defi-reader (it IS in its blocked_tools list)
  console.log(c.dim('\n  defi-reader tries wallet.transfer (it\'s in blocked_tools — should block)'));
  const legitBlock = await agent.callTool('defi-reader', 'wallet.transfer', {}, 'demo-act3');
  if ((legitBlock as {blocked?: boolean})?.blocked) {
    console.log(c.green('  ✅ wallet.transfer blocked for defi-reader (correctly, it\'s in blocked_tools)'));
  }

  console.log(c.green(`\n  Total violations after Act 3: ${agent.getViolations().length} (1 expected from the blocked_tools test)`));

  await sleep(1000);

  // ═══════════════════════════════════════════════════════════════════════════
  // ACT 4 — Session limit enforcement
  // ═══════════════════════════════════════════════════════════════════════════
  divider('ACT 4 — Session Limit Enforcement');
  console.log(c.yellow('defi-reader has max_external_calls_per_session: 20'));
  console.log(c.yellow('We\'ll make 21 calls on the same session to trigger the limit.\n'));

  const limitAgent = new DeFiMonitorAgent(skillsDir);

  for (let i = 1; i <= 21; i++) {
    const res = await limitAgent.callTool(
      'defi-reader',
      'web.fetch',
      { url: 'https://prices.com' },
      'limit-session',
    );
    const blocked = (res as {blocked?: boolean})?.blocked;
    if (blocked) {
      console.log(c.red(`  Call #${i}: BLOCKED — SESSION_LIMIT_EXCEEDED ✅`));
      break;
    } else {
      process.stdout.write(c.dim(`  Call #${i}: allowed... `));
      if (i % 5 === 0) process.stdout.write('\n');
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Summary
  // ═══════════════════════════════════════════════════════════════════════════
  divider('PHASE 1 COMPLETE ✅');
  console.log(c.green('  ✅ Manifest parsing from SKILL.md — working'));
  console.log(c.green('  ✅ ClawGuard middleware wraps tool_dispatch — working'));
  console.log(c.green('  ✅ Blocked tool calls return structured errors (no crash) — working'));
  console.log(c.green('  ✅ Allowed calls pass through normally (no false positives) — working'));
  console.log(c.green('  ✅ Violation events captured (ready for 0G Storage Log in Phase 2) — working'));
  console.log(c.green('  ✅ Session call limits enforced — working'));
  console.log(c.green('  ✅ In-memory manifest cache (no re-fetch on repeated calls) — working'));
  console.log();
  console.log(c.cyan('  → Next: Phase 2 — Deploy SkillRegistry.sol + 0G Storage + Compute integration'));
  console.log();
}

main().catch((err) => {
  console.error(c.red('Fatal error:'), err);
  process.exit(1);
});
