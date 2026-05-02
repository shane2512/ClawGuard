/**
 * Scene 03 — ENS Resolution Chain
 *
 * Resolves ENS_SKILL_NAME -> clawguard.storageKey -> fetches manifest
 * from 0G Storage -> verifies SHA-256 hash.
 *
 * REAL network calls: ENS (Sepolia) + 0G Storage Indexer REST
 * Runtime: ~8-12 seconds
 */

import pc from 'picocolors';
import * as crypto from 'crypto';
import { config } from '../config';

function banner(title: string) {
  const line = '='.repeat(60);
  console.log('\n' + pc.cyan(line));
  console.log(pc.bold(pc.cyan(`  ${title}`)));
  console.log(pc.cyan(line) + '\n');
}

function step(n: number, msg: string) {
  console.log(pc.bold(pc.white(`  [${n}] ${msg}`)));
}

function ok(msg: string) {
  console.log(pc.green(`      OK  ${msg}`));
}

function info(label: string, value: string) {
  console.log(`      ${pc.dim(label.padEnd(18))}: ${pc.cyan(value)}`);
}

async function resolveEnsTextRecord(ensName: string, key: string): Promise<string | null> {
  const { createPublicClient, http } = await import('viem');
  const { sepolia } = await import('viem/chains');
  const { addEnsContracts, ensPublicActions } = await import('@ensdomains/ensjs');
  const { getTextRecord } = await import('@ensdomains/ensjs/public');

  const client = createPublicClient({
    chain: addEnsContracts(sepolia),
    transport: http(config.sepoliaRpc),
  }).extend(ensPublicActions);

  const value = await getTextRecord(client, { name: ensName as `${string}.eth`, key });
  return (value as string | null) ?? null;
}

async function main() {
  banner('SCENE 3: ENS -> 0G STORAGE RESOLUTION CHAIN');

  const ensName = config.ensSkillName;
  console.log(pc.dim(`  Using ENS name: ${ensName}\n`));

  // ── Step 1: ENS Resolution ────────────────────────────────────────────────
  step(1, `Resolving ENS: ${ensName} ...`);
  let storageKey: string;
  let manifestHash: string;
  try {
    const [sk, mh] = await Promise.all([
      resolveEnsTextRecord(ensName, 'clawguard.storageKey'),
      resolveEnsTextRecord(ensName, 'clawguard.manifestHash'),
    ]);
    if (!sk) throw new Error(`No clawguard.storageKey found for ${ensName}`);
    storageKey = sk;
    manifestHash = mh ?? '';
    ok('ENS text records resolved.');
    info('Storage Key', storageKey.slice(0, 20) + '...' + storageKey.slice(-8));
    if (manifestHash) info('Manifest Hash', manifestHash.slice(0, 18) + '...');
    info('ENS Explorer', `https://sepolia.app.ens.domains/${ensName}`);
  } catch (err) {
    console.error(pc.red(`\n  [FAIL] ENS resolution failed: ${String(err)}\n`));
    process.exit(1);
  }

  console.log();

  // ── Step 2: Fetch manifest from 0G Storage ────────────────────────────────
  step(2, 'Fetching manifest from 0G File Storage...');
  let manifestRaw: string;
  try {
    const url = `${config.indexerRpc}/file?root=${storageKey}`;
    info('0G Indexer URL', url);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status} from 0G indexer`);
    manifestRaw = await res.text();
    ok('Manifest downloaded from 0G Storage.');
    info('Size', `${manifestRaw.length} bytes`);
    info('0G StorageScan', `https://storagescan-galileo.0g.ai/tx/${storageKey}`);
  } catch (err) {
    console.error(pc.red(`\n  [FAIL] 0G Storage fetch failed: ${String(err)}\n`));
    process.exit(1);
  }

  console.log();

  // ── Step 3: Parse + show capabilities ─────────────────────────────────────
  step(3, 'Parsing capability manifest...');
  let manifest: Record<string, unknown>;
  try {
    manifest = JSON.parse(manifestRaw.trim());
    const allowed = (manifest['allowedTools'] as string[] | undefined) ?? [];
    const blocked = (manifest['blockedTools'] as string[] | undefined) ?? [];
    ok('Manifest parsed successfully.');
    info('Skill ID', String(manifest['skillId'] ?? 'unknown'));
    info('Allowed Tools', allowed.map((t) => pc.green(t)).join(', '));
    info('Blocked Tools', blocked.map((t) => pc.red(t)).join(', ') || pc.dim('none'));
  } catch (err) {
    console.error(pc.red(`\n  [FAIL] JSON parse failed: ${String(err)}\n`));
    process.exit(1);
  }

  console.log();

  // ── Step 4: Hash verification (tamper-proof check) ────────────────────────
  step(4, 'Verifying manifest integrity (SHA-256 hash check)...');
  if (manifestHash) {
    try {
      const actualHash = crypto
        .createHash('sha256')
        .update(manifestRaw.trim())
        .digest('hex');
      const normalizedExpected = manifestHash.replace(/^0x/, '');

      if (actualHash === normalizedExpected) {
        ok('Hash verified -- manifest has NOT been tampered with.');
        info('Expected', normalizedExpected.slice(0, 18) + '...');
        info('Computed', actualHash.slice(0, 18) + '...');
      } else {
        console.log(pc.red('  [WARN] Hash mismatch -- manifest may have been tampered!'));
        info('Expected', normalizedExpected.slice(0, 18) + '...');
        info('Computed', actualHash.slice(0, 18) + '...');
      }
    } catch (err) {
      console.log(pc.yellow(`  [SKIP] Hash check failed: ${String(err)}`));
    }
  } else {
    console.log(pc.yellow('  [SKIP] No manifestHash in ENS record to verify against.'));
  }

  console.log();
  console.log(pc.bold(pc.white('  ENS -> 0G Storage resolution chain: COMPLETE\n')));
  console.log(pc.dim('  This is how agents auto-discover skill capabilities before installing.\n'));
}

main().catch((err) => {
  console.error(pc.red('\n[Scene 03] Fatal error:'), err);
  process.exit(1);
});
