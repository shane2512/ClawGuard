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
import { CapabilityManifest, ViolationEvent } from './types';
export interface ZGStorageConfig {
    /** 0G Chain EVM RPC (e.g. https://evmrpc-testnet.0g.ai) */
    rpcUrl: string;
    /** 0G Storage indexer RPC (turbo recommended) */
    indexerRpc: string;
    /** Wallet private key (hex with 0x prefix) */
    privateKey: string;
    /** 0G Flow contract address (default: Galileo testnet address) */
    flowContractAddress?: string;
}
export declare class ZGStorageClient {
    private readonly rpcUrl;
    private readonly indexerRpc;
    private readonly privateKey;
    private readonly flowContractAddress;
    constructor(config: ZGStorageConfig);
    private getSigner;
    /**
     * Publishes a CapabilityManifest to 0G Storage as a file.
     *
     * Uses Indexer.upload() — no KV stream permissions required.
     * The returned rootHash is the content-addressable ID to be stored in ENS.
     *
     * @returns rootHash — 0x-prefixed 32-byte Merkle root of the manifest file
     */
    publishManifest(manifest: CapabilityManifest): Promise<{
        storageKey: string;
        txHash: string;
    }>;
    /**
     * Fetches a CapabilityManifest from 0G Storage by root hash.
     *
     * Uses the 0G Indexer REST gateway: GET /file?root=<rootHash>
     * Simpler and more reliable than SDK downloadToBlob — no downloader client needed.
     *
     * @param rootHash     - 0x-prefixed root hash from ENS (clawguard.storageKey)
     * @param expectedHash - Optional manifest hash for tamper detection (Rule S-03)
     */
    fetchManifest(rootHash: string, expectedHash?: string): Promise<CapabilityManifest>;
    /**
     * Logs a ViolationEvent to 0G Storage as a tamper-proof immutable file.
     * @returns rootHash — content-addressable ID (viewable on StorageScan)
     */
    logViolation(event: ViolationEvent): Promise<string>;
}
/**
 * Creates a ZGStorageClient from environment variables.
 */
export declare function createStorageClientFromEnv(): ZGStorageClient;
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
export declare function createViolationAuditHandler(config?: ZGStorageConfig): (event: ViolationEvent) => Promise<void>;
//# sourceMappingURL=storage.d.ts.map