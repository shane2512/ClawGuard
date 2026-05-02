#!/usr/bin/env node
/**
 * ClawGuard CLI — skill submission, verification, and inspection
 *
 * Commands:
 *   clawguard publish <skill-dir>   — upload manifest to 0G Storage + register on-chain
 *   clawguard verify <skill-dir>    — run 0G Compute sealed inference verification
 *   clawguard inspect <skill-id>    — read manifest from 0G Storage KV
 *   clawguard violations <skill-id> — query violation events for a skill
 *   clawguard deploy                — deploy SkillRegistry.sol (Hardhat)
 */

import { Command } from 'commander';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import { ethers } from 'ethers';
import {
  parseSkillManifest,
  createStorageClientFromEnv,
  VerificationStatus,
} from '@clawguard/core';

// Load .env from monorepo root
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

// ANSI colour helpers (no chalk dep needed for a CLI)
const c = {
  green: (s: string) => `\x1b[32m${s}\x1b[0m`,
  red: (s: string) => `\x1b[31m${s}\x1b[0m`,
  yellow: (s: string) => `\x1b[33m${s}\x1b[0m`,
  cyan: (s: string) => `\x1b[36m${s}\x1b[0m`,
  bold: (s: string) => `\x1b[1m${s}\x1b[0m`,
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
};

const program = new Command();

program
  .name('clawguard')
  .description('ClawGuard CLI — declarative capability enforcement for OpenClaw skills')
  .version('0.2.0-onchain');

// ─── publish ─────────────────────────────────────────────────────────────────

program
  .command('publish <skill-dir>')
  .description('Publish a skill manifest to 0G Storage KV and register it on-chain')
  .option('-e, --ens <subname>', 'ENS subname (e.g. defi-reader.skills.clawhub.eth)')
  .action(async (skillDir: string, opts: { ens?: string }) => {
    console.log(c.bold(c.cyan('\n🚀 ClawGuard — Publishing Skill\n')));
    try {
      const { publishSkill } = await import('./publish');
      const result = await publishSkill(path.resolve(skillDir), opts.ens ?? '');

      console.log(c.bold('\n✅ Publish complete:'));
      console.log(`   Skill ID      : ${result.skillId}`);
      console.log(`   Manifest hash : ${result.manifestHash}`);
      console.log(`   0G Storage key: ${result.storageKey}`);
      console.log(`   Storage tx    : ${result.storageTxHash}`);
      if (result.onChainTxHash && result.onChainTxHash !== 'already-registered') {
        console.log(`   On-chain tx   : ${result.onChainTxHash}`);
        console.log(c.dim(`   Explorer: https://chainscan-galileo.0g.ai/tx/${result.onChainTxHash}`));
      }
      console.log();
    } catch (err) {
      console.error(c.red(`\n❌ Publish failed: ${String(err)}\n`));
      process.exit(1);
    }
  });

// ─── verify ──────────────────────────────────────────────────────────────────

program
  .command('verify <skill-dir>')
  .description('Run 0G Compute sealed inference to verify skill capabilities')
  .action(async (skillDir: string) => {
    console.log(c.bold(c.cyan('\n🔍 ClawGuard — Verifying Skill via 0G Compute\n')));
    try {
      const resolvedDir = path.resolve(skillDir);
      const skillId = path.basename(resolvedDir);
      const skillMdPath = path.join(resolvedDir, 'SKILL.md');

      if (!fs.existsSync(skillMdPath)) {
        throw new Error(`SKILL.md not found at: ${skillMdPath}`);
      }

      // Find skill source code (index.ts or index.js)
      const codeFile = ['index.ts', 'index.js', 'skill.ts', 'skill.js']
        .map((f) => path.join(resolvedDir, f))
        .find(fs.existsSync);

      const skillCode = codeFile
        ? fs.readFileSync(codeFile, 'utf-8')
        : fs.readFileSync(skillMdPath, 'utf-8'); // Fallback: analyze SKILL.md itself

      const manifest = parseSkillManifest(
        skillId,
        fs.readFileSync(skillMdPath, 'utf-8'),
      );

      console.log(`Analyzing skill: ${c.bold(skillId)}`);
      console.log(`Code file: ${c.dim(codeFile ?? skillMdPath)}\n`);

      const { verifySkillWithCompute } = await import('./verify');
      const result = await verifySkillWithCompute(skillCode, manifest);

      if (result.status === VerificationStatus.VERIFIED) {
        console.log(c.green(`\n✅ Status: VERIFIED`));
        console.log(c.green(`   Detected tools match declared capabilities.`));
      } else {
        console.log(c.red(`\n❌ Status: CAPABILITY_MISMATCH`));
        console.log(c.red(`   Undeclared tools: ${result.undeclaredTools.join(', ')}`));
      }

      console.log(`\nAll detected tools: ${result.invokedTools.join(', ') || 'none'}`);

      // Update on-chain status if registry is configured
      if (process.env['REGISTRY_ADDRESS'] && process.env['ZG_PRIVATE_KEY']) {
        await updateOnChainStatus(skillId, result.status);
      }

      console.log();
    } catch (err) {
      console.error(c.red(`\n❌ Verify failed: ${String(err)}\n`));
      process.exit(1);
    }
  });

// ─── inspect ─────────────────────────────────────────────────────────────────

program
  .command('inspect <skill-id>')
  .description('Inspect a skill via ENS → 0G File Storage (resolves root hash from ENS)')
  .option('--no-ens', 'Skip ENS lookup — go directly to 0G KV')
  .option('--check-tool <tool>', 'Check if a specific tool is allowed (delegation gate)')
  .action(async (skillId: string, opts: { ens?: boolean; checkTool?: string }) => {
    const isEnsName = skillId.endsWith('.eth') || !skillId.includes(':');
    console.log(c.bold(c.cyan(`\n🔎 ClawGuard — Inspecting Skill: ${c.bold(skillId)}\n`)));

    try {
      let storageKey: string | null = null;
      let ensRecord: import('@clawguard/core').SkillEnsRecord | null = null;

      // ── Step 1: ENS Resolution (Phase 3.2) ───────────────────────────────
      if (opts.ens !== false && process.env['ETH_SEPOLIA_RPC']) {
        console.log(c.dim('  Resolving via ENS...'));
        const { resolveSkillEns, getSkillStorageKey } = await import('@clawguard/core');

        try {
          ensRecord = await resolveSkillEns(skillId);
          if (ensRecord) {
            storageKey = ensRecord.storageKey;
            console.log(`  ENS Name     : ${c.cyan(ensRecord.ensName)}`);
            console.log(`  Status       : ${ensRecord.status === 'ACTIVE' ? c.green('ACTIVE') : c.red(ensRecord.status)}`);
            if (ensRecord.description) console.log(`  Description  : ${ensRecord.description}`);
            if (ensRecord.registryAddr) console.log(`  Registry     : ${c.dim(ensRecord.registryAddr)}`);
            if (ensRecord.manifestHash) console.log(`  Hash (ENS)   : ${c.dim(ensRecord.manifestHash)}`);

            // Revocation gate
            if (ensRecord.status === 'REVOKED') {
              console.log(c.red(`\n  ⛔ Skill is REVOKED on ENS — access denied.\n`));
              process.exit(1);
            }

            console.log(c.dim(`  ENS app      : https://app.ens.domains/${ensRecord.ensName}\n`));
          } else {
            console.log(c.yellow(`  ⚠️  No ENS record found for "${skillId}" — trying 0G KV directly.\n`));
          }
        } catch (ensErr) {
          console.log(c.yellow(`  ⚠️  ENS lookup failed: ${String(ensErr).slice(0, 80)}\n`));
        }
      }

      // ── Step 2: Fetch manifest from 0G File Storage ──────────────────────
      console.log(c.dim('  Fetching manifest from 0G Storage...'));
      const storage = createStorageClientFromEnv();

      // storageKey from ENS is now a 0x root hash (file-based storage)
      // If no ENS record found, we cannot fetch without a root hash
      if (!storageKey) {
        throw new Error(
          `Cannot fetch manifest for "${skillId}" — no ENS record found.\n` +
          `  Ensure the skill has been published and ENS is configured.`,
        );
      }

      const manifest = await storage.fetchManifest(storageKey, ensRecord?.manifestHash ?? undefined);

      // ── Step 3: Display manifest ───────────────────────────────────────────
      console.log(c.bold('\n  Capability Manifest:'));
      console.log(`  Skill ID          : ${c.bold(manifest.skillId)}`);
      console.log(`  Manifest Hash     : ${c.dim(manifest.manifestHash ?? 'n/a')}`);
      console.log(`  Allowed Tools     : ${c.green(manifest.allowedTools.join(', '))}`);
      console.log(`  Blocked Tools     : ${c.red(manifest.blockedTools.join(', ') || 'none')}`);
      console.log(`  Max calls/session : ${manifest.maxExternalCallsPerSession}`);
      if (manifest.createdAt) console.log(`  Created           : ${manifest.createdAt}`);
      if (manifest.ensSubname) console.log(`  ENS Subname       : ${c.cyan(manifest.ensSubname)}`);

      // ── Step 4: Agent-to-agent delegation check ───────────────────────────
      if (opts.checkTool) {
        const tool = opts.checkTool;
        const allowed = manifest.allowedTools.includes(tool);
        const blocked = manifest.blockedTools.includes(tool);
        console.log(c.bold(`\n  Delegation Gate — tool: "${tool}"`));
        if (blocked) {
          console.log(c.red(`  ⛔ DENIED: "${tool}" is explicitly blocked for "${manifest.skillId}"`));
        } else if (allowed) {
          console.log(c.green(`  ✅ ALLOWED: "${tool}" is in declared capabilities`));
        } else {
          console.log(c.yellow(`  ⚠️  BLOCKED (fail-closed): "${tool}" not declared in capabilities`));
        }
      }

      console.log();
    } catch (err) {
      console.error(c.red(`\n❌ Inspect failed: ${String(err)}\n`));
      process.exit(1);
    }
  });


// ─── Helper: update on-chain verification status ─────────────────────────────

async function updateOnChainStatus(skillId: string, status: VerificationStatus): Promise<void> {
  const REGISTRY_ABI = [
    'function updateVerificationStatus(bytes32 skillId, uint8 status) external',
  ];
  const statusMap = {
    [VerificationStatus.PENDING]: 0,
    [VerificationStatus.VERIFIED]: 1,
    [VerificationStatus.CAPABILITY_MISMATCH]: 2,
  };

  try {
    const provider = new ethers.JsonRpcProvider(process.env['ZG_CHAIN_RPC']);
    const signer = new ethers.Wallet(process.env['ZG_PRIVATE_KEY']!, provider);
    const registry = new ethers.Contract(process.env['REGISTRY_ADDRESS']!, REGISTRY_ABI, signer);

    const skillIdBytes32 = ethers.keccak256(ethers.toUtf8Bytes(skillId));
    const tx = await registry.updateVerificationStatus(skillIdBytes32, statusMap[status]);
    await tx.wait();
    console.log(c.cyan(`\n🏅 Badge anchored on 0G Chain: ${status}`));
    console.log(c.cyan(`   Tx hash : ${tx.hash}`));
    console.log(c.dim(`   Explorer: https://chainscan-galileo.0g.ai/tx/${tx.hash}`));
  } catch (err) {
    console.warn(c.yellow(`\n⚠️  Could not update on-chain status: ${String(err)}`));
  }
}

program.parse(process.argv);
