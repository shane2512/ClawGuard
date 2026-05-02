/**
 * Scene 02 — Show the Manifest Format
 *
 * Reads both SKILL.md files and pretty-prints the [CAPABILITIES] block.
 * Shows the contrast: what defi-reader declares vs what rogue-defi-skill hides.
 *
 * Runtime: ~3 seconds (all local, no network)
 */

import * as fs from 'fs';
import * as path from 'path';
import pc from 'picocolors';

function banner(title: string) {
  const line = '='.repeat(60);
  console.log('\n' + pc.cyan(line));
  console.log(pc.bold(pc.cyan(`  ${title}`)));
  console.log(pc.cyan(line) + '\n');
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function extractCapabilities(content: string): {
  allowedTools: string[];
  blockedTools: string[];
  maxCalls: number;
} {
  const capBlock = content.split('[CAPABILITIES]')[1] ?? '';
  const allowedMatch = capBlock.match(/allowed_tools:\s*([\s\S]*?)(?=blocked_tools:|max_external|$)/);
  const blockedMatch = capBlock.match(/blocked_tools:\s*([\s\S]*?)(?=allowed_tools:|max_external|$)/);
  const maxMatch = capBlock.match(/max_external_calls_per_session:\s*(\d+)/);

  const parseList = (block: string | undefined): string[] => {
    if (!block) return [];
    return (block.match(/- ([\w.]+)/g) ?? []).map((s) => s.replace('- ', '').trim());
  };

  return {
    allowedTools: parseList(allowedMatch?.[1]),
    blockedTools: parseList(blockedMatch?.[1]),
    maxCalls: parseInt(maxMatch?.[1] ?? '0', 10),
  };
}

function printManifest(skillName: string, content: string, isRogue = false) {
  const cap = extractCapabilities(content);
  const label = isRogue ? pc.red(`  [${skillName}] (ROGUE)`) : pc.green(`  [${skillName}] (LEGIT)`);
  console.log(label);
  console.log(pc.dim('  ' + '-'.repeat(40)));

  console.log(`  Allowed tools  : ${cap.allowedTools.length > 0
    ? cap.allowedTools.map((t) => pc.green(t)).join(', ')
    : pc.dim('none')}`);

  console.log(`  Blocked tools  : ${cap.blockedTools.length > 0
    ? cap.blockedTools.map((t) => pc.red(t)).join(', ')
    : pc.yellow('NONE DECLARED')}`);

  console.log(`  Max calls/sess : ${pc.cyan(String(cap.maxCalls))}`);
}

async function main() {
  banner('SCENE 2: THE CAPABILITY MANIFEST FORMAT');

  const skillsDir = path.join(__dirname, '..', 'skills');

  // ── Show defi-reader ────────────────────────────────────────────────────────
  console.log(pc.bold('  Step 1 — A legitimate skill declares its capabilities:\n'));
  const legitPath = path.join(skillsDir, 'defi-reader', 'SKILL.md');
  const legitContent = fs.readFileSync(legitPath, 'utf-8');

  // Print the raw SKILL.md section
  const capSection = legitContent.split('[CAPABILITIES]');
  console.log(pc.dim('  --- SKILL.md ---'));
  console.log(pc.dim('  ' + capSection[0].trim().split('\n').slice(0, 4).join('\n  ')));
  console.log(pc.white('\n  [CAPABILITIES]'));
  (capSection[1] ?? '').trim().split('\n').forEach((line) => {
    if (line.includes('allowed')) console.log(pc.green('  ' + line));
    else if (line.includes('blocked')) console.log(pc.red('  ' + line));
    else console.log(pc.cyan('  ' + line));
  });
  console.log(pc.dim('  ----------------\n'));

  await sleep(1000);

  // ── Show rogue skill ────────────────────────────────────────────────────────
  console.log(pc.bold('  Step 2 — A rogue skill that LOOKS legitimate:\n'));
  const roguePath = path.join(skillsDir, 'rogue-defi-skill', 'SKILL.md');
  const rogueContent = fs.readFileSync(roguePath, 'utf-8');
  const rogueCapSection = rogueContent.split('[CAPABILITIES]');

  console.log(pc.dim('  --- rogue-defi-skill/SKILL.md ---'));
  (rogueCapSection[1] ?? '').trim().split('\n').slice(0, 6).forEach((line) => {
    if (line.includes('allowed')) console.log(pc.yellow('  ' + line));
    else if (line.includes('blocked')) console.log(pc.yellow('  ' + line));
    else if (line.trim() === '') return;
    else console.log(pc.cyan('  ' + line));
  });
  console.log(pc.dim('  ---------------------------------\n'));

  await sleep(800);

  // ── Side-by-side comparison ─────────────────────────────────────────────────
  console.log(pc.bold('  DECLARED vs ACTUAL (what 0G Compute fingerprint will detect):\n'));
  console.log(pc.dim('  ' + '-'.repeat(56)));
  console.log(`  ${'SKILL'.padEnd(24)} ${'DECLARED'.padEnd(14)} ${'ACTUAL (hidden)'}`);
  console.log(pc.dim('  ' + '-'.repeat(56)));
  console.log(`  ${'defi-reader'.padEnd(24)} ${pc.green('read_balance'.padEnd(14))} ${pc.green('read_balance')}`);
  console.log(`  ${'defi-reader'.padEnd(24)} ${pc.green('web.fetch'.padEnd(14))} ${pc.green('web.fetch')}`);
  console.log(`  ${'rogue-defi-skill'.padEnd(24)} ${pc.yellow('web.fetch'.padEnd(14))} ${pc.yellow('web.fetch')}`);
  console.log(`  ${'rogue-defi-skill'.padEnd(24)} ${pc.yellow('read_balance'.padEnd(14))} ${pc.yellow('read_balance')}`);
  console.log(`  ${'rogue-defi-skill'.padEnd(24)} ${pc.red('NOT declared'.padEnd(14))} ${pc.red('wallet.TRANSFER  <-- ATTACK')}`);
  console.log(pc.dim('  ' + '-'.repeat(56)) + '\n');

  await sleep(600);
  console.log(pc.bold(pc.white('  ClawGuard enforces the declared list. wallet.transfer gets blocked.\n')));
}

main().catch((err) => {
  console.error(pc.red('\n[Scene 02] Fatal error:'), err);
  process.exit(1);
});
