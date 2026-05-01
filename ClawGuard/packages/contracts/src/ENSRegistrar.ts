/**
 * ClawGuard ENS Registrar
 * =======================
 * CLI script that registers skill subnames under skills.clawhub.eth
 * and sets all ClawGuard text records on Sepolia testnet.
 *
 * Usage:
 *   # Register a skill subname
 *   npx ts-node packages/contracts/src/ENSRegistrar.ts register \
 *     --skill defi-reader \
 *     --storage-key "skill:defi-reader:manifest" \
 *     --manifest-hash "0xabc..." \
 *     --description "DeFi read-only agent"
 *
 *   # Resolve a skill's ENS record (read-only)
 *   npx ts-node packages/contracts/src/ENSRegistrar.ts resolve --skill defi-reader
 *
 *   # Revoke a skill
 *   npx ts-node packages/contracts/src/ENSRegistrar.ts revoke --skill defi-reader
 *
 *   # Bootstrap: create the skills.clawhub.eth subdomain itself
 *   npx ts-node packages/contracts/src/ENSRegistrar.ts bootstrap
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

import {
  resolveSkillEns,
  registerSkillEns,
  revokeSkillEns,
  bootstrapSkillsSubdomain,
  getEnsConfigFromEnv,
  skillToEnsName,
} from '../../core/src/ens';

// ── Colours ───────────────────────────────────────────────────────────────────
const c = {
  green:  (s: string) => `\x1b[32m${s}\x1b[0m`,
  red:    (s: string) => `\x1b[31m${s}\x1b[0m`,
  yellow: (s: string) => `\x1b[33m${s}\x1b[0m`,
  cyan:   (s: string) => `\x1b[36m${s}\x1b[0m`,
  bold:   (s: string) => `\x1b[1m${s}\x1b[0m`,
  dim:    (s: string) => `\x1b[2m${s}\x1b[0m`,
};

// ── Arg parser ────────────────────────────────────────────────────────────────
function parseArgs(argv: string[]): Record<string, string> {
  const args: Record<string, string> = {};
  let i = 0;
  while (i < argv.length) {
    if (argv[i].startsWith('--')) {
      const key = argv[i].replace(/^--/, '').replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      args[key] = argv[i + 1] ?? 'true';
      i += 2;
    } else {
      args['_command'] = argv[i];
      i++;
    }
  }
  return args;
}

// ── Commands ──────────────────────────────────────────────────────────────────

async function cmdBootstrap(): Promise<void> {
  console.log(c.bold('\n🔧 Bootstrap: Creating skills.clawhub.eth subdomain\n'));

  const { privateKey } = getEnsConfigFromEnv();
  const rpc = process.env['ETH_SEPOLIA_RPC'] ?? 'https://ethereum-sepolia-rpc.publicnode.com';

  console.log(`  Wallet  : ${c.cyan('0x' + privateKey.replace('0x','').slice(0,8) + '...')}`);
  console.log(`  Network : Sepolia (${rpc})\n`);

  await bootstrapSkillsSubdomain(privateKey);

  console.log(c.dim('\n  View: https://app.ens.domains/skills.clawhub.eth'));
}

async function cmdRegister(args: Record<string, string>): Promise<void> {
  const skillId = args['skill'];
  if (!skillId) throw new Error('--skill is required');

  const { privateKey, registryAddr } = getEnsConfigFromEnv();

  // storageKey defaults to the standard format
  const storageKey = args['storageKey'] ?? `skill:${skillId}:manifest`;
  const manifestHash = args['manifestHash'] ?? '';
  const description = args['description'];
  const url = args['url'];

  console.log(c.bold(`\n📝 Registering ENS subname for skill: ${c.cyan(skillId)}\n`));
  console.log(`  ENS Name     : ${c.cyan(skillToEnsName(skillId))}`);
  console.log(`  Storage Key  : ${c.dim(storageKey)}`);
  console.log(`  Manifest Hash: ${c.dim(manifestHash || '(none)')}`);
  console.log(`  Registry     : ${c.dim(registryAddr)}\n`);

  const ensName = await registerSkillEns({
    privateKey,
    skillId,
    storageKey,
    manifestHash,
    registryAddr,
    description,
    url,
  });

  console.log(c.green(`\n✅ Done! Skill ENS record live:`));
  console.log(`   ${c.bold(ensName)}`);
  console.log(c.dim(`   View: https://app.ens.domains/${ensName}`));
}

async function cmdResolve(args: Record<string, string>): Promise<void> {
  const skillId = args['skill'];
  if (!skillId) throw new Error('--skill is required');

  const ensName = skillToEnsName(skillId);
  console.log(c.bold(`\n🔍 Resolving ENS record: ${c.cyan(ensName)}\n`));

  const record = await resolveSkillEns(skillId);

  if (!record) {
    console.log(c.red(`❌ No ClawGuard record found for: ${ensName}`));
    console.log(c.dim(`   Run: npx ts-node packages/contracts/src/ENSRegistrar.ts register --skill ${skillId}`));
    return;
  }

  console.log(`  ENS Name     : ${c.cyan(record.ensName)}`);
  console.log(`  Storage Key  : ${c.green(record.storageKey)}`);
  console.log(`  Manifest Hash: ${c.dim(record.manifestHash || '(none)')}`);
  console.log(`  Registry     : ${c.dim(record.registryAddr || '(none)')}`);
  console.log(`  Status       : ${record.status === 'ACTIVE' ? c.green('ACTIVE') : c.red(record.status)}`);
  if (record.description) console.log(`  Description  : ${record.description}`);
  if (record.url)         console.log(`  URL          : ${c.dim(record.url)}`);
  console.log(c.dim(`\n  View: https://app.ens.domains/${record.ensName}`));
}

async function cmdRevoke(args: Record<string, string>): Promise<void> {
  const skillId = args['skill'];
  if (!skillId) throw new Error('--skill is required');

  const { privateKey } = getEnsConfigFromEnv();
  console.log(c.bold(`\n🚫 Revoking skill: ${c.red(skillToEnsName(skillId))}\n`));

  const hash = await revokeSkillEns(skillId, privateKey);
  console.log(c.green('\n✅ Skill revoked on-chain.'));
  console.log(c.dim(`   Tx: https://sepolia.etherscan.io/tx/${hash}`));
}

function printHelp(): void {
  console.log(c.bold('\nClawGuard ENS Registrar\n'));
  console.log('Commands:');
  console.log(`  ${c.cyan('bootstrap')}              Create skills.clawhub.eth subdomain`);
  console.log(`  ${c.cyan('register')}               Register a skill subname + set text records`);
  console.log(`    ${c.dim('--skill')}      <id>     Skill ID (e.g. defi-reader)`);
  console.log(`    ${c.dim('--storage-key')} <key>   0G KV key (default: skill:{id}:manifest)`);
  console.log(`    ${c.dim('--manifest-hash')} <h>   SHA-256 hash from 0G Storage`);
  console.log(`    ${c.dim('--description')} <txt>   Human-readable description`);
  console.log(`    ${c.dim('--url')} <url>           Documentation URL`);
  console.log(`  ${c.cyan('resolve')}                Look up a skill's ENS text records (read-only)`);
  console.log(`    ${c.dim('--skill')}      <id>     Skill ID or full ENS name`);
  console.log(`  ${c.cyan('revoke')}                 Set status=REVOKED on a skill`);
  console.log(`    ${c.dim('--skill')}      <id>     Skill ID`);
  console.log('');
  console.log('Required env: ZG_PRIVATE_KEY, REGISTRY_ADDRESS, ETH_SEPOLIA_RPC');
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const command = args['_command'];

  try {
    switch (command) {
      case 'bootstrap': await cmdBootstrap(); break;
      case 'register':  await cmdRegister(args); break;
      case 'resolve':   await cmdResolve(args); break;
      case 'revoke':    await cmdRevoke(args); break;
      default:          printHelp(); break;
    }
  } catch (err) {
    console.error(c.red('\n❌ Error:'), String(err));
    process.exit(1);
  }
}

main();
