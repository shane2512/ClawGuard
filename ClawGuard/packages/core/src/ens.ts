/**
 * Phase 3: ENS Integration
 * ========================
 * Resolves ClawGuard skill names via ENS text records on Sepolia.
 *
 * Naming scheme:
 *   {skillId}.skills.clawhub.eth
 *
 * Text records stored per subname:
 *   clawguard.storageKey     → "skill:{skillId}:manifest"  (0G KV key)
 *   clawguard.manifestHash   → "0x..."                     (SHA-256 hash)
 *   clawguard.registryAddr   → "0x..."                     (SkillRegistry contract)
 *   clawguard.status         → "ACTIVE" | "REVOKED"
 *   description              → human-readable skill description
 *   url                      → link to skill documentation
 *
 * Read:  @ensdomains/ensjs v3 (viem-based) — auto-resolves via universal resolver
 * Write: ethers v6 direct contract calls — setText/setSubnodeOwner on ENS registry
 */

import { ethers } from 'ethers';
import { createPublicClient, http, namehash } from 'viem';
import { sepolia } from 'viem/chains';
import { addEnsContracts, ensPublicActions } from '@ensdomains/ensjs';
import { getTextRecord, getResolver } from '@ensdomains/ensjs/public';

// ─── ENS Contract Addresses (Sepolia) ─────────────────────────────────────────

const ENS_REGISTRY    = '0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e' as const;

// Minimal ABIs for direct contract calls
const REGISTRY_ABI = [
  'function setSubnodeOwner(bytes32 node, bytes32 label, address owner) external returns (bytes32)',
  'function setResolver(bytes32 node, address resolver) external',
  'function resolver(bytes32 node) external view returns (address)',
  'function owner(bytes32 node) external view returns (address)',
];

const RESOLVER_ABI = [
  'function setText(bytes32 node, string key, string value) external',
  'function text(bytes32 node, string key) external view returns (string)',
];

// ─── Config ───────────────────────────────────────────────────────────────────

const SKILLS_PARENT = 'skills.clawhub.eth';

/** All ClawGuard text record keys */
export const ENS_KEYS = {
  storageKey:   'clawguard.storageKey',
  manifestHash: 'clawguard.manifestHash',
  registryAddr: 'clawguard.registryAddr',
  status:       'clawguard.status',
  description:  'description',
  url:          'url',
} as const;

export interface SkillEnsRecord {
  ensName: string;
  storageKey: string;
  manifestHash: string;
  registryAddr: string;
  status: string;
  description?: string;
  url?: string;
}

export interface RegisterSkillEnsOptions {
  privateKey: string;
  skillId: string;
  storageKey: string;
  manifestHash: string;
  registryAddr: string;
  description?: string;
  url?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getSepoliaRpc(): string {
  return process.env['ETH_SEPOLIA_RPC'] ?? 'https://ethereum-sepolia-rpc.publicnode.com';
}

/** Converts a skillId to its full ENS subname. */
export function skillToEnsName(skillId: string): string {
  if (skillId.endsWith('.eth')) return skillId;
  return `${skillId}.${SKILLS_PARENT}`;
}

/** Builds a viem public client with ENS extensions for reads. */
function buildPublicClient() {
  return createPublicClient({
    chain: addEnsContracts(sepolia),
    transport: http(getSepoliaRpc()),
  }).extend(ensPublicActions);
}

/** Builds an ethers signer for write operations. */
function buildSigner(privateKey: string): ethers.Wallet {
  const provider = new ethers.JsonRpcProvider(getSepoliaRpc());
  const pk = privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`;
  return new ethers.Wallet(pk, provider);
}

/** Gets the ENS resolver address for a given name. */
async function getResolverAddress(ensName: string): Promise<string> {
  try {
    const client = buildPublicClient();
    const resolved = await getResolver(client, { name: ensName });
    if (resolved && resolved !== '0x0000000000000000000000000000000000000000') {
      return resolved;
    }
  } catch {
    // fall through
  }
  // Fallback: read directly from ENS registry
  const provider = new ethers.JsonRpcProvider(getSepoliaRpc());
  const registry = new ethers.Contract(ENS_REGISTRY, REGISTRY_ABI, provider);
  return registry.resolver(namehash(ensName as `${string}.eth`));
}

// ─── ENS Resolution (Read via viem+ensjs) ────────────────────────────────────

/**
 * Resolves all ClawGuard text records for a skill ENS name.
 * Uses ensjs universal resolver — auto-discovers the resolver.
 */
export async function resolveSkillEns(skillId: string): Promise<SkillEnsRecord | null> {
  const ensName = skillToEnsName(skillId);
  const client = buildPublicClient();

  const [storageKey, manifestHash, registryAddr, status, description, url] = await Promise.all([
    getTextRecord(client, { name: ensName, key: ENS_KEYS.storageKey   }).catch(() => null),
    getTextRecord(client, { name: ensName, key: ENS_KEYS.manifestHash }).catch(() => null),
    getTextRecord(client, { name: ensName, key: ENS_KEYS.registryAddr }).catch(() => null),
    getTextRecord(client, { name: ensName, key: ENS_KEYS.status       }).catch(() => null),
    getTextRecord(client, { name: ensName, key: ENS_KEYS.description  }).catch(() => null),
    getTextRecord(client, { name: ensName, key: ENS_KEYS.url          }).catch(() => null),
  ]);

  if (!storageKey) return null;

  return {
    ensName,
    storageKey:   storageKey as string,
    manifestHash: (manifestHash as string) ?? '',
    registryAddr: (registryAddr as string) ?? '',
    status:       (status as string) ?? 'ACTIVE',
    description:  description as string | undefined,
    url:          url as string | undefined,
  };
}

/**
 * Fetches just the 0G KV storage key for a skill.
 * Lightweight path used by the middleware.
 */
export async function getSkillStorageKey(skillId: string): Promise<string | null> {
  const ensName = skillToEnsName(skillId);
  const client = buildPublicClient();
  const value = await getTextRecord(client, { name: ensName, key: ENS_KEYS.storageKey })
    .catch(() => null);
  return (value as string | null) ?? null;
}

// ─── ENS Registration (Write via ethers direct contracts) ─────────────────────

/**
 * Creates skills.clawhub.eth subdomain under clawhub.eth.
 * Uses ENS registry setSubnodeOwner directly.
 */
export async function bootstrapSkillsSubdomain(privateKey: string): Promise<void> {
  const signer = buildSigner(privateKey);
  const registry = new ethers.Contract(ENS_REGISTRY, REGISTRY_ABI, signer);

  const clawhubNode = namehash('clawhub.eth');
  const skillsLabel = ethers.keccak256(ethers.toUtf8Bytes('skills'));
  const resolverAddr = await getResolverAddress('clawhub.eth');

  console.log(`[ENS] Resolver for clawhub.eth: ${resolverAddr}`);

  // Check current owner of skills.clawhub.eth
  const skillsNode = namehash('skills.clawhub.eth');
  const currentOwner = await registry.owner(skillsNode);

  if (currentOwner.toLowerCase() === signer.address.toLowerCase()) {
    console.log('[ENS] skills.clawhub.eth already owned by this wallet — skipping setSubnodeOwner.');
  } else {
    console.log('[ENS] Creating skills.clawhub.eth via setSubnodeOwner...');
    const tx = await registry.setSubnodeOwner(clawhubNode, skillsLabel, signer.address);
    await tx.wait();
    console.log(`[ENS] ✅ skills.clawhub.eth created | tx: ${tx.hash}`);
  }

  // Set resolver on skills.clawhub.eth to match clawhub.eth's resolver
  const skillsResolver = await registry.resolver(skillsNode);
  if (skillsResolver.toLowerCase() !== resolverAddr.toLowerCase()) {
    const tx2 = await registry.setResolver(skillsNode, resolverAddr);
    await tx2.wait();
    console.log(`[ENS] Resolver set on skills.clawhub.eth | tx: ${tx2.hash}`);
  }
}

/**
 * Registers a skill subname and sets all ClawGuard text records.
 * Uses ENS registry + resolver direct contract calls.
 */
export async function registerSkillEns(opts: RegisterSkillEnsOptions): Promise<string> {
  const ensName = skillToEnsName(opts.skillId);
  const signer = buildSigner(opts.privateKey);
  const registry = new ethers.Contract(ENS_REGISTRY, REGISTRY_ABI, signer);

  // Step 1: Create subname via setSubnodeOwner
  const skillsNode = namehash('skills.clawhub.eth');
  const skillLabel = ethers.keccak256(ethers.toUtf8Bytes(opts.skillId));
  const skillNode = namehash(ensName as `${string}.eth`);

  const currentOwner = await registry.owner(skillNode);
  if (currentOwner.toLowerCase() !== signer.address.toLowerCase()) {
    console.log(`[ENS] Creating subname: ${ensName}`);
    const tx = await registry.setSubnodeOwner(skillsNode, skillLabel, signer.address);
    await tx.wait();
    console.log(`[ENS] Subname created | tx: ${tx.hash}`);
  } else {
    console.log(`[ENS] Subname already exists, updating records...`);
  }

  // Step 2: Set resolver on the subname
  const resolverAddr = await getResolverAddress('clawhub.eth');
  const currentResolver = await registry.resolver(skillNode);
  if (currentResolver.toLowerCase() !== resolverAddr.toLowerCase()) {
    const tx = await registry.setResolver(skillNode, resolverAddr);
    await tx.wait();
    console.log(`[ENS] Resolver set on ${ensName} | tx: ${tx.hash}`);
  }

  // Step 3: Set text records via resolver.setText()
  const resolver = new ethers.Contract(resolverAddr, RESOLVER_ABI, signer);
  const records: Array<[string, string]> = [
    [ENS_KEYS.storageKey,   opts.storageKey],
    [ENS_KEYS.manifestHash, opts.manifestHash],
    [ENS_KEYS.registryAddr, opts.registryAddr],
    [ENS_KEYS.status,       'ACTIVE'],
  ];
  if (opts.description) records.push([ENS_KEYS.description, opts.description]);
  if (opts.url)         records.push([ENS_KEYS.url,         opts.url]);

  for (const [key, value] of records) {
    const tx = await resolver.setText(skillNode, key, value);
    await tx.wait();
    console.log(`[ENS] Set ${key} | tx: ${tx.hash}`);
  }

  console.log(`[ENS] ✅ ${ensName} registered`);
  return ensName;
}

/**
 * Revokes a skill by setting its ENS status text record to REVOKED.
 */
export async function revokeSkillEns(skillId: string, privateKey: string): Promise<string> {
  const ensName = skillToEnsName(skillId);
  const signer = buildSigner(privateKey);
  const skillNode = namehash(ensName as `${string}.eth`);
  const resolverAddr = await getResolverAddress(ensName);
  const resolver = new ethers.Contract(resolverAddr, RESOLVER_ABI, signer);

  const tx = await resolver.setText(skillNode, ENS_KEYS.status, 'REVOKED');
  await tx.wait();
  console.log(`[ENS] ✅ Skill revoked: ${ensName} | tx: ${tx.hash}`);
  return tx.hash;
}

// ─── Convenience factory from env ─────────────────────────────────────────────

export function getEnsConfigFromEnv(): { privateKey: string; registryAddr: string } {
  const privateKey = process.env['ZG_PRIVATE_KEY'];
  const registryAddr = process.env['REGISTRY_ADDRESS'];
  if (!privateKey) throw new Error('Missing ZG_PRIVATE_KEY in .env');
  if (!registryAddr) throw new Error('Missing REGISTRY_ADDRESS in .env');
  return { privateKey, registryAddr };
}
