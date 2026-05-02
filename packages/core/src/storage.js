"use strict";
/**
 * Phase 2.2 + 2.3: 0G Storage integration
 * - File Store: publish/fetch CapabilityManifest via Indexer upload/download
 * - File Store: append-only ViolationEvent log (tamper-proof audit trail)
 *
 * Uses @0gfoundation/0g-ts-sdk (installed in packages/core/node_modules)
 *
 * Storage strategy (v2 — File-based, no KV):
 *   publishManifest: uploads manifest JSON as a MemData file → rootHash is
 *   the content-addressable ID stored in ENS (clawguard.storageKey).
 *   fetchManifest: downloads by rootHash using Indexer.downloadToBlob().
 *
 *   This avoids the 0G KV stream permission issues entirely:
 *   - KV streams are owned by specific wallets
 *   - File storage is open: any wallet can upload, any wallet can download by hash
 *
 * 0G Galileo Testnet:
 *   Flow contract : 0x22E03a6A89B950F1c82ec5e74F8eCa321a105296
 *   Indexer (turbo): https://indexer-storage-testnet-turbo.0g.ai
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ZGStorageClient = void 0;
exports.createStorageClientFromEnv = createStorageClientFromEnv;
exports.createViolationAuditHandler = createViolationAuditHandler;
const ethers_1 = require("ethers");
const manifest_1 = require("./manifest");
// ─── Lazy-loaded SDK ──────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _sdk = null;
function sdk() {
    if (!_sdk) {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        _sdk = require('@0gfoundation/0g-ts-sdk');
    }
    return _sdk;
}
const DEFAULT_FLOW_CONTRACT = '0x22E03a6A89B950F1c82ec5e74F8eCa321a105296';
// ─── ZGStorageClient ──────────────────────────────────────────────────────────
class ZGStorageClient {
    rpcUrl;
    indexerRpc;
    privateKey;
    flowContractAddress;
    constructor(config) {
        this.rpcUrl = config.rpcUrl;
        this.indexerRpc = config.indexerRpc;
        this.privateKey = config.privateKey;
        this.flowContractAddress = config.flowContractAddress ?? DEFAULT_FLOW_CONTRACT;
    }
    getSigner() {
        const provider = new ethers_1.ethers.JsonRpcProvider(this.rpcUrl);
        return new ethers_1.ethers.Wallet(this.privateKey, provider);
    }
    // ── File-based Manifest Store ──────────────────────────────────────────────
    /**
     * Publishes a CapabilityManifest to 0G Storage as a file.
     *
     * Uses Indexer.upload() — no KV stream permissions required.
     * The returned rootHash is the content-addressable ID to be stored in ENS.
     *
     * @returns rootHash — 0x-prefixed 32-byte Merkle root of the manifest file
     */
    async publishManifest(manifest) {
        const { Indexer, MemData } = sdk();
        const jsonBytes = new TextEncoder().encode(JSON.stringify(manifest));
        const memData = new MemData(jsonBytes);
        // Compute root hash locally (Merkle tree of the file content)
        const [tree, treeErr] = await memData.merkleTree();
        if (treeErr !== null)
            throw new Error(`0G: Merkle tree error: ${treeErr}`);
        const rootHash = tree?.rootHash() ?? 'unknown';
        const signer = this.getSigner();
        const indexer = new Indexer(this.indexerRpc);
        console.log(`[0G Storage] Uploading manifest as file...`);
        console.log(`[0G Storage] Root hash (content ID): ${rootHash}`);
        const [uploadResult, uploadErr] = await indexer.upload(memData, this.rpcUrl, signer);
        if (uploadErr !== null)
            throw new Error(`0G manifest upload failed: ${uploadErr}`);
        const txHash = uploadResult?.txHash ?? rootHash;
        console.log(`[0G Storage] Manifest uploaded. Root: ${rootHash} | Tx: ${txHash}`);
        // storageKey IS the rootHash — this is what gets stored in ENS
        return { storageKey: rootHash, txHash };
    }
    /**
     * Fetches a CapabilityManifest from 0G Storage by root hash.
     *
     * Uses the 0G Indexer REST gateway: GET /file?root=<rootHash>
     * Simpler and more reliable than SDK downloadToBlob — no downloader client needed.
     *
     * @param rootHash     - 0x-prefixed root hash from ENS (clawguard.storageKey)
     * @param expectedHash - Optional manifest hash for tamper detection (Rule S-03)
     */
    async fetchManifest(rootHash, expectedHash) {
        if (!rootHash || rootHash === '' || rootHash.startsWith('skill:')) {
            throw new Error(`MANIFEST_KEY_FORMAT: storageKey "${rootHash}" looks like an old KV key.\n` +
                `  → Re-publish the skill to store as a file:\n` +
                `    npx ts-node -r tsconfig-paths/register --project packages/cli/tsconfig.json --transpile-only packages/cli/src/index.ts publish packages/example-agent/skills/defi-reader`);
        }
        // Use indexer REST gateway: GET /file?root=<hash>
        const url = `${this.indexerRpc}/file?root=${rootHash}`;
        console.log(`[0G Storage] Fetching manifest via REST: ${url}`);
        let raw;
        try {
            const res = await fetch(url);
            if (!res.ok) {
                throw new Error(`MANIFEST_DOWNLOAD_FAILED: HTTP ${res.status} from 0G indexer.\n` +
                    `  URL       : ${url}\n\n` +
                    `  This may be a propagation delay — try again in 30–60s.\n` +
                    `  Or re-publish: npx ts-node -r tsconfig-paths/register --project packages/cli/tsconfig.json --transpile-only packages/cli/src/index.ts publish packages/example-agent/skills/defi-reader`);
            }
            raw = await res.text();
        }
        catch (err) {
            if (String(err).includes('MANIFEST_'))
                throw err;
            throw new Error(`MANIFEST_FETCH_ERROR: Network error reaching 0G indexer.\n` +
                `  URL   : ${url}\n` +
                `  Error : ${err}`);
        }
        if (!raw || raw.trim() === '') {
            throw new Error(`MANIFEST_EMPTY: 0G returned empty content for root hash ${rootHash}.\n` +
                `  → Propagation may be in progress. Wait 30s and retry.`);
        }
        const manifest = JSON.parse(raw.trim());
        // Rule S-03: verify hash integrity (normalize 0x prefix from ENS records)
        if (expectedHash) {
            const actualHash = (0, manifest_1.hashManifest)(manifest).replace(/^0x/, '');
            const normalizedExpected = expectedHash.replace(/^0x/, '');
            if (actualHash !== normalizedExpected) {
                throw new Error(`MANIFEST_TAMPERED: hash mismatch.\n` +
                    `  Expected : ${normalizedExpected}\n` +
                    `  Got      : ${actualHash}`);
            }
        }
        return manifest;
    }
    // ── Violation Audit Log ───────────────────────────────────────────────────
    /**
     * Logs a ViolationEvent to 0G Storage as a tamper-proof immutable file.
     * @returns rootHash — content-addressable ID (viewable on StorageScan)
     */
    async logViolation(event) {
        const { Indexer, MemData } = sdk();
        // Rule S-02: strip sensitive fields before logging
        const safeEvent = {
            skillId: event.skillId,
            blockedTool: event.blockedTool,
            agentId: event.agentId,
            timestamp: event.timestamp,
            sessionId: event.sessionId,
            reason: event.reason,
        };
        const data = new TextEncoder().encode(JSON.stringify(safeEvent));
        const memData = new MemData(data);
        const [tree, treeErr] = await memData.merkleTree();
        if (treeErr !== null)
            throw new Error(`0G: Merkle tree error: ${treeErr}`);
        const rootHash = tree?.rootHash() ?? 'unknown';
        const signer = this.getSigner();
        const indexer = new Indexer(this.indexerRpc);
        const [, uploadErr] = await indexer.upload(memData, this.rpcUrl, signer);
        if (uploadErr !== null)
            throw new Error(`0G: Violation log upload failed: ${uploadErr}`);
        console.log(`[0G Storage] Violation logged.`);
        console.log(`  Root hash : ${rootHash}`);
        console.log(`  View at   : https://storagescan-galileo.0g.ai/tx/${rootHash}`);
        return rootHash;
    }
}
exports.ZGStorageClient = ZGStorageClient;
// ─── Factory from environment variables ──────────────────────────────────────
/**
 * Creates a ZGStorageClient from environment variables.
 */
function createStorageClientFromEnv() {
    const required = {
        ZG_CHAIN_RPC: process.env['ZG_CHAIN_RPC'],
        ZG_INDEXER_RPC: process.env['ZG_INDEXER_RPC'],
        ZG_PRIVATE_KEY: process.env['ZG_PRIVATE_KEY'],
    };
    const missing = Object.entries(required)
        .filter(([, v]) => !v || v.includes('YOUR_PRIVATE_KEY'))
        .map(([k]) => k);
    if (missing.length > 0) {
        throw new Error(`Missing required env vars for 0G Storage: ${missing.join(', ')}\n` +
            `Copy .env.example to .env and fill in the values.`);
    }
    return new ZGStorageClient({
        rpcUrl: required['ZG_CHAIN_RPC'],
        indexerRpc: required['ZG_INDEXER_RPC'],
        privateKey: required['ZG_PRIVATE_KEY'],
        flowContractAddress: process.env['ZG_FLOW_CONTRACT'],
    });
}
// ─── Violation Audit Handler factory ─────────────────────────────────────────
/**
 * Creates a ViolationHandler that uploads every blocked tool call event to
 * 0G Storage Log as a tamper-proof, append-only audit entry.
 *
 * Designed to be passed directly to addViolationHandler(), or wired
 * automatically via the `auditLog: true` option in ClawGuardConfig.
 *
 * @param config - Optional ZGStorageConfig; falls back to ZG_* env vars
 * @returns An async handler that logs violations to 0G Storage on each call
 *
 * @example
 * ```typescript
 * import { createViolationAuditHandler, addViolationHandler } from '@shanejoans/clawguard';
 * addViolationHandler(dispatch, createViolationAuditHandler());
 * ```
 */
function createViolationAuditHandler(config) {
    // Lazily instantiated — avoids env-var errors at module load time
    let client = null;
    return async (event) => {
        try {
            if (!client) {
                client = config ? new ZGStorageClient(config) : createStorageClientFromEnv();
            }
            const rootHash = await client.logViolation(event);
            console.log(`[0G Audit] ✅ Violation uploaded to 0G Storage Log`);
            console.log(`[0G Audit]    Skill    : ${event.skillId} | Tool: ${event.blockedTool}`);
            console.log(`[0G Audit]    Root hash: ${rootHash}`);
            console.log(`[0G Audit]    View     : https://storagescan-galileo.0g.ai/tx/${rootHash}`);
        }
        catch (err) {
            // Non-fatal — enforcement must never crash because audit logging failed
            console.error(`[0G Audit] ⚠️  Violation log upload failed (non-fatal): ` +
                String(err).slice(0, 120));
        }
    };
}
//# sourceMappingURL=storage.js.map