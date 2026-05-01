/**
 * Phase 2.1 + 3: Skill publish command
 * 1. Parse SKILL.md → CapabilityManifest
 * 2. Upload manifest to 0G Storage KV
 * 3. Register skill on SkillRegistry.sol (0G Chain)
 * 4. Register ENS subname under skills.clawhub.eth (Sepolia)
 */

import * as fs from 'fs';
import * as path from 'path';
import { ethers } from 'ethers';
import {
  parseSkillManifest,
  createStorageClientFromEnv,
  CapabilityManifest,
} from '@clawguard/core';

// Minimal ABI for SkillRegistry interactions
const REGISTRY_ABI = [
  'function registerSkill(bytes32 skillId, bytes32 manifestHash, string calldata storageAddress, string calldata ensSubname) external',
  'function isRegistered(bytes32 skillId) external view returns (bool)',
  'function getSkillRecord(bytes32 skillId) external view returns (tuple(bytes32 manifestHash, string storageAddress, uint8 status, string ensSubname, uint256 registeredAt, address registrant))',
  'event SkillRegistered(bytes32 indexed skillId, bytes32 manifestHash, string storageAddress, address indexed registrant)',
];

export interface PublishResult {
  skillId: string;
  manifestHash: string;
  storageKey: string;
  storageTxHash: string;
  onChainTxHash: string;
  registryAddress: string;
  ensName?: string;
}

/**
 * Publishes a skill to 0G Storage KV, registers it on SkillRegistry.sol,
 * and registers the ENS subname under skills.clawhub.eth.
 *
 * @param skillDir   - Directory containing SKILL.md
 * @param ensSubname - Override ENS subname (default: {skillId}.skills.clawhub.eth)
 * @param skipEns    - Skip ENS registration (e.g. for local testing)
 * @param description - Optional skill description for ENS text record
 * @param url         - Optional documentation URL for ENS text record
 */
export async function publishSkill(
  skillDir: string,
  ensSubname: string = '',
  skipEns: boolean = false,
  description?: string,
  url?: string,
): Promise<PublishResult> {
  // ── Step 1: Parse SKILL.md ─────────────────────────────────────────────────
  const skillMdPath = path.join(skillDir, 'SKILL.md');
  if (!fs.existsSync(skillMdPath)) {
    throw new Error(`SKILL.md not found at: ${skillMdPath}`);
  }

  const skillId = path.basename(skillDir);
  const content = fs.readFileSync(skillMdPath, 'utf-8');
  const manifest: CapabilityManifest = parseSkillManifest(skillId, content);

  console.log(`\n[Publish] Skill: ${skillId}`);
  console.log(`[Publish] Manifest hash: ${manifest.manifestHash}`);
  console.log(`[Publish] Allowed tools: ${manifest.allowedTools.join(', ')}`);

  // ── Step 2: Upload to 0G Storage KV ───────────────────────────────────────
  console.log('\n[0G Storage] Uploading manifest to 0G KV store...');
  const storage = createStorageClientFromEnv();
  const { storageKey, txHash: storageTxHash } = await storage.publishManifest(manifest);

  // ── Step 3: Register on SkillRegistry.sol ─────────────────────────────────
  const registryAddress = process.env['REGISTRY_ADDRESS'];
  if (!registryAddress) {
    console.warn('\n⚠️  REGISTRY_ADDRESS not set — skipping on-chain registration.');
    return {
      skillId,
      manifestHash: manifest.manifestHash!,
      storageKey,
      storageTxHash,
      onChainTxHash: '',
      registryAddress: '',
    };
  }

  // Build the ENS name used in the on-chain record
  const resolvedEnsName = ensSubname || `${skillId}.skills.clawhub.eth`;

  console.log(`\n[0G Chain] Registering skill on SkillRegistry: ${registryAddress}`);
  const rpcUrl = process.env['ZG_CHAIN_RPC']!;
  const privateKey = process.env['ZG_PRIVATE_KEY']!;
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const signer = new ethers.Wallet(privateKey, provider);
  const registry = new ethers.Contract(registryAddress, REGISTRY_ABI, signer);

  const skillIdBytes32 = ethers.keccak256(ethers.toUtf8Bytes(skillId));

  const alreadyRegistered = await registry.isRegistered(skillIdBytes32);
  let onChainTxHash = 'already-registered';

  if (!alreadyRegistered) {
    const manifestHashBytes32 = `0x${manifest.manifestHash!.padStart(64, '0')}` as `0x${string}`;

    const tx = await registry.registerSkill(
      skillIdBytes32,
      manifestHashBytes32,
      storageKey,
      resolvedEnsName,
    );

    console.log(`[0G Chain] Tx submitted: ${tx.hash}`);
    const receipt = await tx.wait();
    console.log(`[0G Chain] ✅ Confirmed in block ${receipt.blockNumber}`);
    console.log(`[0G Chain] Explorer: https://chainscan-galileo.0g.ai/tx/${tx.hash}`);
    onChainTxHash = tx.hash;
  } else {
    console.log('[0G Chain] Skill already registered on-chain. Skipping.');
  }

  // ── Step 4: Register ENS subname (Sepolia) ─────────────────────────────────
  let registeredEnsName: string | undefined;

  if (!skipEns && process.env['ETH_SEPOLIA_RPC'] && process.env['ZG_PRIVATE_KEY']) {
    console.log(`\n[ENS] Registering subname: ${resolvedEnsName}`);
    try {
      const { registerSkillEns } = await import('@clawguard/core');
      registeredEnsName = await registerSkillEns({
        privateKey,
        skillId,
        storageKey,
        manifestHash: `0x${manifest.manifestHash!.padStart(64, '0')}`,
        registryAddr: registryAddress,
        description,
        url,
      });
      console.log(`[ENS] ✅ ${registeredEnsName}`);
      console.log(`[ENS] View: https://app.ens.domains/${registeredEnsName}`);
    } catch (err) {
      console.warn(`[ENS] ⚠️  ENS registration failed (non-fatal): ${err}`);
      console.warn('[ENS]    Run manually: npx ts-node packages/contracts/src/ENSRegistrar.ts register --skill ' + skillId);
    }
  } else if (!skipEns) {
    console.log('\n[ENS] Skipping — ETH_SEPOLIA_RPC not configured.');
  }

  return {
    skillId,
    manifestHash: manifest.manifestHash!,
    storageKey,
    storageTxHash,
    onChainTxHash,
    registryAddress,
    ensName: registeredEnsName,
  };
}

