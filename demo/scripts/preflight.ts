/**
 * /demo/scripts/preflight.ts
 *
 * Run this before every recording session: npm run preflight
 * Checks all external dependencies and exits 1 if any critical check fails.
 */

import pc from 'picocolors';
import { ethers } from 'ethers';
import { config } from '../config';

interface Check {
  name: string;
  status: 'PASS' | 'FAIL' | 'WARN';
  detail: string;
  critical: boolean;
}

const results: Check[] = [];

function pass(name: string, detail: string, critical = true) {
  results.push({ name, status: 'PASS', detail, critical });
  console.log(pc.green(`  [PASS] ${name}`));
  console.log(pc.dim(`         ${detail}`));
}

function fail(name: string, detail: string, critical = true) {
  results.push({ name, status: 'FAIL', detail, critical });
  console.log(pc.red(`  [FAIL] ${name}`));
  console.log(pc.red(`         ${detail}`));
}

function warn(name: string, detail: string) {
  results.push({ name, status: 'WARN', detail, critical: false });
  console.log(pc.yellow(`  [WARN] ${name}`));
  console.log(pc.yellow(`         ${detail}`));
}

// ── Check 1: 0G Chain connectivity ────────────────────────────────────────────
async function check0GChain() {
  try {
    const provider = new ethers.JsonRpcProvider(config.chainRpc);
    const network = await Promise.race([
      provider.getNetwork(),
      new Promise<never>((_, rej) => setTimeout(() => rej(new Error('timeout after 8s')), 8000)),
    ]) as Awaited<ReturnType<typeof provider.getNetwork>>;
    pass('0G Chain RPC', `chainId=${network.chainId}  url=${config.chainRpc}`);
  } catch (err) {
    fail('0G Chain RPC', `Cannot connect: ${String(err).slice(0, 80)}`);
  }
}

// ── Check 2: 0G Storage Indexer ───────────────────────────────────────────────
async function check0GIndexer() {
  try {
    const res = await Promise.race([
      fetch(`${config.indexerRpc}/file?root=0x0000000000000000000000000000000000000000000000000000000000000001`),
      new Promise<never>((_, rej) => setTimeout(() => rej(new Error('timeout')), 8000)),
    ]) as Response;
    if ([200, 400, 404].includes(res.status)) {
      pass('0G Storage Indexer', `HTTP ${res.status} (reachable)  url=${config.indexerRpc}`);
    } else {
      warn('0G Storage Indexer', `Unexpected HTTP ${res.status} from indexer`);
    }
  } catch (err) {
    fail('0G Storage Indexer', `Cannot reach: ${String(err).slice(0, 80)}`);
  }
}

// ── Check 3: Wallet balance ────────────────────────────────────────────────────
async function checkWalletBalance() {
  try {
    const provider = new ethers.JsonRpcProvider(config.chainRpc);
    const wallet = new ethers.Wallet(config.privateKey, provider);
    const bal = await provider.getBalance(wallet.address);
    const balEth = parseFloat(ethers.formatEther(bal));
    const addr = wallet.address.slice(0, 10) + '...' + wallet.address.slice(-6);
    if (balEth >= 0.01) {
      pass('Wallet Balance', `${addr}: ${balEth.toFixed(4)} OG  (>= 0.01 required)`);
    } else {
      warn('Wallet Balance', `${addr}: ${balEth.toFixed(6)} OG -- LOW. Faucet: https://faucet.0g.ai`);
    }
  } catch (err) {
    fail('Wallet Balance', `Cannot check balance: ${String(err).slice(0, 80)}`);
  }
}

// ── Check 4: ENS resolution ────────────────────────────────────────────────────
async function checkEns() {
  try {
    const { createPublicClient, http } = await import('viem');
    const { sepolia } = await import('viem/chains');
    const { addEnsContracts, ensPublicActions } = await import('@ensdomains/ensjs');
    const { getTextRecord } = await import('@ensdomains/ensjs/public');

    const client = createPublicClient({
      chain: addEnsContracts(sepolia),
      transport: http(config.sepoliaRpc),
    }).extend(ensPublicActions);

    const storageKey = await Promise.race([
      getTextRecord(client, { name: config.ensSkillName as `${string}.eth`, key: 'clawguard.storageKey' }),
      new Promise<never>((_, rej) => setTimeout(() => rej(new Error('timeout after 15s')), 15000)),
    ]);

    if (storageKey) {
      pass('ENS Resolution', `${config.ensSkillName} -> ${String(storageKey).slice(0, 30)}...`);
    } else {
      fail('ENS Resolution', `clawguard.storageKey record is empty for ${config.ensSkillName}`);
    }
  } catch (err) {
    fail('ENS Resolution', `Failed: ${String(err).slice(0, 100)}`);
  }
}

// ── Check 5: SkillRegistry contract ───────────────────────────────────────────
async function checkRegistry() {
  if (!config.registryAddress) {
    warn('SkillRegistry', 'REGISTRY_ADDRESS not set -- on-chain badge in scene 05 will be skipped');
    return;
  }
  try {
    const provider = new ethers.JsonRpcProvider(config.chainRpc);
    const registry = new ethers.Contract(
      config.registryAddress,
      ['function totalSkills() external view returns (uint256)'],
      provider,
    );
    const total = await Promise.race([
      registry.totalSkills() as Promise<bigint>,
      new Promise<never>((_, rej) => setTimeout(() => rej(new Error('timeout')), 8000)),
    ]);
    pass('SkillRegistry', `${config.registryAddress}  totalSkills=${total.toString()}`);
  } catch (err) {
    fail('SkillRegistry', `Cannot call contract: ${String(err).slice(0, 80)}`);
  }
}

// ── Check 6: Skill manifests exist locally ────────────────────────────────────
async function checkSkillFiles() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const fs = require('fs') as typeof import('fs');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const path = require('path') as typeof import('path');
  const skillsDir = path.join(__dirname, '..', 'skills');

  const defiPath = path.join(skillsDir, 'defi-reader', 'SKILL.md');
  const roguePath = path.join(skillsDir, 'rogue-defi-skill', 'SKILL.md');

  if (fs.existsSync(defiPath)) {
    pass('Skill: defi-reader', `SKILL.md found at ${defiPath}`);
  } else {
    fail('Skill: defi-reader', `SKILL.md NOT FOUND at ${defiPath}`);
  }

  if (fs.existsSync(roguePath)) {
    pass('Skill: rogue-defi-skill', `SKILL.md found at ${roguePath}`);
  } else {
    fail('Skill: rogue-defi-skill', `SKILL.md NOT FOUND at ${roguePath}`);
  }
}

// ── Main ────────────────────────────────────────────────────────────────────────
async function main() {
  const line = '='.repeat(60);
  console.log('\n' + pc.bold(pc.cyan(line)));
  console.log(pc.bold(pc.cyan('  ClawGuard Demo -- Pre-Flight Check')));
  console.log(pc.bold(pc.cyan(line)) + '\n');

  await check0GChain();
  console.log();
  await check0GIndexer();
  console.log();
  await checkWalletBalance();
  console.log();
  await checkEns();
  console.log();
  await checkRegistry();
  console.log();
  await checkSkillFiles();
  console.log();

  const failures = results.filter((r) => r.status === 'FAIL' && r.critical);
  const warnings = results.filter((r) => r.status === 'WARN');
  const passes   = results.filter((r) => r.status === 'PASS');

  console.log(pc.dim(line));
  console.log(`  ${pc.green(`PASS: ${passes.length}`)}  ${pc.yellow(`WARN: ${warnings.length}`)}  ${pc.red(`FAIL: ${failures.length}`)}`);

  if (failures.length === 0) {
    console.log(pc.bold(pc.green('\n  All systems ready. Start recording!\n')));
    process.exit(0);
  } else {
    console.log(pc.bold(pc.red(`\n  ${failures.length} critical check(s) failed. Fix before recording.\n`)));
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(pc.red('\n[preflight] Fatal:'), err);
  process.exit(1);
});
