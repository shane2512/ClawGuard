"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ENS_KEYS = void 0;
exports.skillToEnsName = skillToEnsName;
exports.resolveSkillEns = resolveSkillEns;
exports.getSkillStorageKey = getSkillStorageKey;
exports.bootstrapSkillsSubdomain = bootstrapSkillsSubdomain;
exports.registerSkillEns = registerSkillEns;
exports.revokeSkillEns = revokeSkillEns;
exports.getEnsConfigFromEnv = getEnsConfigFromEnv;
const ethers_1 = require("ethers");
const viem_1 = require("viem");
const chains_1 = require("viem/chains");
const ensjs_1 = require("@ensdomains/ensjs");
const public_1 = require("@ensdomains/ensjs/public");
// ─── ENS Contract Addresses (Sepolia) ─────────────────────────────────────────
const ENS_REGISTRY = '0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e';
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
exports.ENS_KEYS = {
    storageKey: 'clawguard.storageKey',
    manifestHash: 'clawguard.manifestHash',
    registryAddr: 'clawguard.registryAddr',
    status: 'clawguard.status',
    description: 'description',
    url: 'url',
};
// ─── Helpers ──────────────────────────────────────────────────────────────────
function getSepoliaRpc() {
    return process.env['ETH_SEPOLIA_RPC'] ?? 'https://ethereum-sepolia-rpc.publicnode.com';
}
/** Converts a skillId to its full ENS subname. */
function skillToEnsName(skillId) {
    if (skillId.endsWith('.eth'))
        return skillId;
    return `${skillId}.${SKILLS_PARENT}`;
}
/** Builds a viem public client with ENS extensions for reads. */
function buildPublicClient() {
    return (0, viem_1.createPublicClient)({
        chain: (0, ensjs_1.addEnsContracts)(chains_1.sepolia),
        transport: (0, viem_1.http)(getSepoliaRpc()),
    }).extend(ensjs_1.ensPublicActions);
}
/** Builds an ethers signer for write operations. */
function buildSigner(privateKey) {
    const provider = new ethers_1.ethers.JsonRpcProvider(getSepoliaRpc());
    const pk = privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`;
    return new ethers_1.ethers.Wallet(pk, provider);
}
/** Gets the ENS resolver address for a given name. */
async function getResolverAddress(ensName) {
    try {
        const client = buildPublicClient();
        const resolved = await (0, public_1.getResolver)(client, { name: ensName });
        if (resolved && resolved !== '0x0000000000000000000000000000000000000000') {
            return resolved;
        }
    }
    catch {
        // fall through
    }
    // Fallback: read directly from ENS registry
    const provider = new ethers_1.ethers.JsonRpcProvider(getSepoliaRpc());
    const registry = new ethers_1.ethers.Contract(ENS_REGISTRY, REGISTRY_ABI, provider);
    return registry.resolver((0, viem_1.namehash)(ensName));
}
// ─── ENS Resolution (Read via viem+ensjs) ────────────────────────────────────
/**
 * Resolves all ClawGuard text records for a skill ENS name.
 * Uses ensjs universal resolver — auto-discovers the resolver.
 */
async function resolveSkillEns(skillId) {
    const ensName = skillToEnsName(skillId);
    const client = buildPublicClient();
    const [storageKey, manifestHash, registryAddr, status, description, url] = await Promise.all([
        (0, public_1.getTextRecord)(client, { name: ensName, key: exports.ENS_KEYS.storageKey }).catch(() => null),
        (0, public_1.getTextRecord)(client, { name: ensName, key: exports.ENS_KEYS.manifestHash }).catch(() => null),
        (0, public_1.getTextRecord)(client, { name: ensName, key: exports.ENS_KEYS.registryAddr }).catch(() => null),
        (0, public_1.getTextRecord)(client, { name: ensName, key: exports.ENS_KEYS.status }).catch(() => null),
        (0, public_1.getTextRecord)(client, { name: ensName, key: exports.ENS_KEYS.description }).catch(() => null),
        (0, public_1.getTextRecord)(client, { name: ensName, key: exports.ENS_KEYS.url }).catch(() => null),
    ]);
    if (!storageKey)
        return null;
    return {
        ensName,
        storageKey: storageKey,
        manifestHash: manifestHash ?? '',
        registryAddr: registryAddr ?? '',
        status: status ?? 'ACTIVE',
        description: description,
        url: url,
    };
}
/**
 * Fetches just the 0G KV storage key for a skill.
 * Lightweight path used by the middleware.
 */
async function getSkillStorageKey(skillId) {
    const ensName = skillToEnsName(skillId);
    const client = buildPublicClient();
    const value = await (0, public_1.getTextRecord)(client, { name: ensName, key: exports.ENS_KEYS.storageKey })
        .catch(() => null);
    return value ?? null;
}
// ─── ENS Registration (Write via ethers direct contracts) ─────────────────────
/**
 * Creates skills.clawhub.eth subdomain under clawhub.eth.
 * Uses ENS registry setSubnodeOwner directly.
 */
async function bootstrapSkillsSubdomain(privateKey) {
    const signer = buildSigner(privateKey);
    const registry = new ethers_1.ethers.Contract(ENS_REGISTRY, REGISTRY_ABI, signer);
    const clawhubNode = (0, viem_1.namehash)('clawhub.eth');
    const skillsLabel = ethers_1.ethers.keccak256(ethers_1.ethers.toUtf8Bytes('skills'));
    const resolverAddr = await getResolverAddress('clawhub.eth');
    console.log(`[ENS] Resolver for clawhub.eth: ${resolverAddr}`);
    // Check current owner of skills.clawhub.eth
    const skillsNode = (0, viem_1.namehash)('skills.clawhub.eth');
    const currentOwner = await registry.owner(skillsNode);
    if (currentOwner.toLowerCase() === signer.address.toLowerCase()) {
        console.log('[ENS] skills.clawhub.eth already owned by this wallet — skipping setSubnodeOwner.');
    }
    else {
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
async function registerSkillEns(opts) {
    const ensName = skillToEnsName(opts.skillId);
    const signer = buildSigner(opts.privateKey);
    const registry = new ethers_1.ethers.Contract(ENS_REGISTRY, REGISTRY_ABI, signer);
    // Step 1: Create subname via setSubnodeOwner
    const skillsNode = (0, viem_1.namehash)('skills.clawhub.eth');
    const skillLabel = ethers_1.ethers.keccak256(ethers_1.ethers.toUtf8Bytes(opts.skillId));
    const skillNode = (0, viem_1.namehash)(ensName);
    const currentOwner = await registry.owner(skillNode);
    if (currentOwner.toLowerCase() !== signer.address.toLowerCase()) {
        console.log(`[ENS] Creating subname: ${ensName}`);
        const tx = await registry.setSubnodeOwner(skillsNode, skillLabel, signer.address);
        await tx.wait();
        console.log(`[ENS] Subname created | tx: ${tx.hash}`);
    }
    else {
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
    const resolver = new ethers_1.ethers.Contract(resolverAddr, RESOLVER_ABI, signer);
    const records = [
        [exports.ENS_KEYS.storageKey, opts.storageKey],
        [exports.ENS_KEYS.manifestHash, opts.manifestHash],
        [exports.ENS_KEYS.registryAddr, opts.registryAddr],
        [exports.ENS_KEYS.status, 'ACTIVE'],
    ];
    if (opts.description)
        records.push([exports.ENS_KEYS.description, opts.description]);
    if (opts.url)
        records.push([exports.ENS_KEYS.url, opts.url]);
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
async function revokeSkillEns(skillId, privateKey) {
    const ensName = skillToEnsName(skillId);
    const signer = buildSigner(privateKey);
    const skillNode = (0, viem_1.namehash)(ensName);
    const resolverAddr = await getResolverAddress(ensName);
    const resolver = new ethers_1.ethers.Contract(resolverAddr, RESOLVER_ABI, signer);
    const tx = await resolver.setText(skillNode, exports.ENS_KEYS.status, 'REVOKED');
    await tx.wait();
    console.log(`[ENS] ✅ Skill revoked: ${ensName} | tx: ${tx.hash}`);
    return tx.hash;
}
// ─── Convenience factory from env ─────────────────────────────────────────────
function getEnsConfigFromEnv() {
    const privateKey = process.env['ZG_PRIVATE_KEY'];
    const registryAddr = process.env['REGISTRY_ADDRESS'];
    if (!privateKey)
        throw new Error('Missing ZG_PRIVATE_KEY in .env');
    if (!registryAddr)
        throw new Error('Missing REGISTRY_ADDRESS in .env');
    return { privateKey, registryAddr };
}
//# sourceMappingURL=ens.js.map