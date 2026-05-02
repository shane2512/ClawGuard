#!/usr/bin/env ts-node
/**
 * ClawGuard Pre-Demo Preflight Check
 *
 * Run before any hackathon demo or judge evaluation:
 *   npm run preflight
 *
 * Checks every external dependency and prints a PASS/FAIL table.
 * Exit code 0 = all critical checks pass. Non-zero = at least one critical check failed.
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import { ethers } from 'ethers';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

// ─── ANSI colours ─────────────────────────────────────────────────────────────
const GREEN  = (s: string) => `\x1b[32m${s}\x1b[0m`;
const RED    = (s: string) => `\x1b[31m${s}\x1b[0m`;
const YELLOW = (s: string) => `\x1b[33m${s}\x1b[0m`;
const CYAN   = (s: string) => `\x1b[36m${s}\x1b[0m`;
const BOLD   = (s: string) => `\x1b[1m${s}\x1b[0m`;
const DIM    = (s: string) => `\x1b[2m${s}\x1b[0m`;

interface CheckResult {
  name: string;
  status: 'PASS' | 'FAIL' | 'WARN';
  detail: string;
  critical: boolean;
}

const results: CheckResult[] = [];

function pass(name: string, detail: string, critical = true): void {
  results.push({ name, status: 'PASS', detail, critical });
}
function fail(name: string, detail: string, critical = true): void {
  results.push({ name, status: 'FAIL', detail, critical });
}
function warn(name: string, detail: string): void {
  results.push({ name, status: 'WARN', detail, critical: false });
}

// ─── Checks ───────────────────────────────────────────────────────────────────

/** 1. Environment variables */
async function checkEnvVars(): Promise<void> {
  const required = ['ZG_CHAIN_RPC', 'ZG_INDEXER_RPC', 'ZG_PRIVATE_KEY', 'ETH_SEPOLIA_RPC'];
  const optional = ['REGISTRY_ADDRESS'];

  for (const key of required) {
    const val = process.env[key];
    if (val && !val.includes('YOUR_')) {
      pass(`ENV: ${key}`, DIM(val.slice(0, 40) + (val.length > 40 ? '...' : '')));
    } else {
      fail(`ENV: ${key}`, 'Not set or still placeholder in .env');
    }
  }
  for (const key of optional) {
    const val = process.env[key];
    if (val) {
      pass(`ENV: ${key}`, DIM(val), false);
    } else {
      warn(`ENV: ${key}`, 'Not set — on-chain badge will be skipped');
    }
  }
}

/** 2. 0G Chain RPC connectivity */
async function check0GChain(): Promise<void> {
  const rpc = process.env['ZG_CHAIN_RPC'];
  if (!rpc) { fail('0G Chain RPC', 'ZG_CHAIN_RPC not set'); return; }
  try {
    const provider = new ethers.JsonRpcProvider(rpc);
    const network = await Promise.race([
      provider.getNetwork(),
      new Promise<never>((_, rej) => setTimeout(() => rej(new Error('timeout')), 8000)),
    ]) as Awaited<ReturnType<typeof provider.getNetwork>>;
    pass('0G Chain RPC', `chainId=${network.chainId} (${rpc})`);
  } catch (err) {
    fail('0G Chain RPC', `Cannot connect: ${String(err).slice(0, 80)}`);
  }
}

/** 3. 0G Storage Indexer REST API */
async function check0GIndexer(): Promise<void> {
  const rpc = process.env['ZG_INDEXER_RPC'] ?? 'https://indexer-storage-testnet-turbo.0g.ai';
  try {
    // Use /file with a zero hash — 404 means the endpoint is alive and routing correctly
    const res = await Promise.race([
      fetch(`${rpc}/file?root=0x0000000000000000000000000000000000000000000000000000000000000001`),
      new Promise<never>((_, rej) => setTimeout(() => rej(new Error('timeout')), 8000)),
    ]) as Response;
    // 200 = file found, 404 = not found (both mean the server is up and routing)
    if (res.status === 200 || res.status === 404 || res.status === 400) {
      pass('0G Indexer REST', `${rpc} → HTTP ${res.status} (reachable)`);
    } else {
      warn('0G Indexer REST', `Unexpected HTTP ${res.status} from ${rpc}`);
    }
  } catch (err) {
    fail('0G Indexer REST', `Cannot reach: ${String(err).slice(0, 80)}`);
  }
}

/** 4. ENS resolution for defi-reader skill */
async function checkEnsResolution(): Promise<void> {
  const sepoliaRpc = process.env['ETH_SEPOLIA_RPC'];
  if (!sepoliaRpc) { fail('ENS Resolution', 'ETH_SEPOLIA_RPC not set'); return; }
  try {
    // Lazy import to avoid requiring all deps at the top
    const { createPublicClient, http } = await import('viem');
    const { sepolia } = await import('viem/chains');
    const { addEnsContracts, ensPublicActions } = await import('@ensdomains/ensjs');
    const { getTextRecord } = await import('@ensdomains/ensjs/public');

    const client = createPublicClient({
      chain: addEnsContracts(sepolia),
      transport: http(sepoliaRpc),
    }).extend(ensPublicActions);

    const storageKey = await Promise.race([
      getTextRecord(client, { name: 'defi-reader.skills.clawhub.eth', key: 'clawguard.storageKey' }),
      new Promise<never>((_, rej) => setTimeout(() => rej(new Error('timeout')), 15000)),
    ]);

    if (storageKey) {
      pass('ENS Resolution', `defi-reader.skills.clawhub.eth → ${String(storageKey).slice(0, 30)}...`);
    } else {
      fail('ENS Resolution', 'ENS record found but clawguard.storageKey is empty');
    }
  } catch (err) {
    fail('ENS Resolution', `Failed: ${String(err).slice(0, 100)}`);
  }
}

/** 5. SkillRegistry contract on 0G Chain */
async function checkSkillRegistry(): Promise<void> {
  const registryAddr = process.env['REGISTRY_ADDRESS'];
  const rpc = process.env['ZG_CHAIN_RPC'];
  if (!registryAddr) { warn('SkillRegistry', 'REGISTRY_ADDRESS not set — on-chain badge skipped'); return; }
  if (!rpc) { fail('SkillRegistry', 'ZG_CHAIN_RPC not set'); return; }
  try {
    const provider = new ethers.JsonRpcProvider(rpc);
    const registry = new ethers.Contract(
      registryAddr,
      ['function totalSkills() external view returns (uint256)'],
      provider,
    );
    const total = await Promise.race([
      registry.totalSkills(),
      new Promise<never>((_, rej) => setTimeout(() => rej(new Error('timeout')), 8000)),
    ]);
    pass('SkillRegistry', `${registryAddr} — ${total.toString()} skills registered`);
  } catch (err) {
    fail('SkillRegistry', `Cannot call contract: ${String(err).slice(0, 80)}`);
  }
}

/** 6. Wallet balance check (for 0G transactions) */
async function checkWalletBalance(): Promise<void> {
  const pk = process.env['ZG_PRIVATE_KEY'];
  const rpc = process.env['ZG_CHAIN_RPC'];
  if (!pk || !rpc) { fail('Wallet Balance', 'ZG_PRIVATE_KEY or ZG_CHAIN_RPC not set'); return; }
  try {
    const provider = new ethers.JsonRpcProvider(rpc);
    const wallet = new ethers.Wallet(pk, provider);
    const balance = await provider.getBalance(wallet.address);
    const balanceEth = parseFloat(ethers.formatEther(balance));
    const addr = wallet.address.slice(0, 10) + '...' + wallet.address.slice(-6);

    if (balanceEth >= 0.01) {
      pass('Wallet Balance', `${addr}: ${balanceEth.toFixed(4)} OG`);
    } else {
      warn('Wallet Balance', `${addr}: ${balanceEth.toFixed(6)} OG — low balance, may fail tx. Faucet: https://faucet.0g.ai`);
    }
  } catch (err) {
    fail('Wallet Balance', `Cannot check: ${String(err).slice(0, 80)}`);
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log(BOLD(CYAN('\n╔══════════════════════════════════════════════╗')));
  console.log(BOLD(CYAN('║   ClawGuard Pre-Demo Preflight Check         ║')));
  console.log(BOLD(CYAN('╚══════════════════════════════════════════════╝\n')));

  console.log('Running checks...\n');

  await checkEnvVars();
  await check0GChain();
  await check0GIndexer();
  await checkEnsResolution();
  await checkSkillRegistry();
  await checkWalletBalance();

  // ── Print results table ──────────────────────────────────────────────────
  console.log(BOLD('\n┌─────────────────────────────────────────────────────────────────────┐'));
  console.log(BOLD('│  Check                       Status  Detail                         │'));
  console.log(BOLD('├─────────────────────────────────────────────────────────────────────┤'));

  for (const r of results) {
    const statusBadge =
      r.status === 'PASS' ? GREEN(' PASS ') :
      r.status === 'WARN' ? YELLOW(' WARN ') :
      RED(' FAIL ');
    const name = r.name.padEnd(28);
    const detail = r.detail.replace(/\x1b\[[0-9;]*m/g, '').slice(0, 36).padEnd(36); // strip ANSI for length
    console.log(`│  ${name} [${statusBadge}]  ${r.detail.slice(0, 36)}`);
  }

  console.log(BOLD('└─────────────────────────────────────────────────────────────────────┘'));

  const failures = results.filter((r) => r.status === 'FAIL' && r.critical);
  const warnings = results.filter((r) => r.status === 'WARN');
  const passes   = results.filter((r) => r.status === 'PASS');

  console.log(`\n  ${GREEN(`✅ ${passes.length} passed`)}  ${YELLOW(`⚠️  ${warnings.length} warnings`)}  ${RED(`❌ ${failures.length} critical failures`)}`);

  if (failures.length > 0) {
    console.log(RED('\n  ❌ PREFLIGHT FAILED — fix the above issues before running the demo.\n'));
    process.exit(1);
  } else if (warnings.length > 0) {
    console.log(YELLOW('\n  ⚠️  PREFLIGHT PASSED WITH WARNINGS — demo will work but some features may be limited.\n'));
    process.exit(0);
  } else {
    console.log(GREEN('\n  ✅ PREFLIGHT PASSED — all systems ready for demo!\n'));
    process.exit(0);
  }
}

main().catch((err) => {
  console.error(RED('\nPreflight script error:'), err);
  process.exit(1);
});
