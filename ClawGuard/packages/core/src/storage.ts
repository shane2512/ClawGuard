/**
 * Phase 2.2 + 2.3: 0G Storage integration
 * - KV Store: publish/fetch CapabilityManifest (write-once, read-many)
 * - File Store: append-only ViolationEvent log (tamper-proof audit trail)
 *
 * Uses @0gfoundation/0g-ts-sdk (installed in packages/core/node_modules)
 *
 * KV Node Discovery (Option A):
 *   Rather than hardcoding a single KV node endpoint that may be unreachable,
 *   we dynamically discover all storage nodes from the indexer and probe each
 *   one on port 6789 to find a reachable KV node at runtime.
 *
 * 0G Galileo Testnet:
 *   Flow contract : 0x22E03a6A89B950F1c82ec5e74F8eCa321a105296
 *   Indexer (turbo): https://indexer-storage-testnet-turbo.0g.ai
 */

import * as http from 'http';
import { ethers } from 'ethers';
import { CapabilityManifest, ViolationEvent } from './types';
import { hashManifest } from './manifest';

// ─── Lazy-loaded SDK ──────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _sdk: any = null;
function sdk() {
  if (!_sdk) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    _sdk = require('@0gfoundation/0g-ts-sdk');
  }
  return _sdk;
}

// ─── Configuration ────────────────────────────────────────────────────────────

export interface ZGStorageConfig {
  /** 0G Chain EVM RPC (e.g. https://evmrpc-testnet.0g.ai) */
  rpcUrl: string;
  /** 0G Storage indexer RPC (turbo recommended) */
  indexerRpc: string;
  /**
   * Optional: explicit KV node endpoint.
   * If omitted, the client will auto-discover a reachable KV node
   * from the indexer's node list (Option A — dynamic discovery).
   */
  kvNodeRpc?: string;
  /** Wallet private key (hex with 0x prefix) */
  privateKey: string;
  /** Stream ID (bytes32 hex) — the "bucket" for all ClawGuard KV entries. */
  streamId?: string;
  /** 0G Flow contract address (default: Galileo testnet address) */
  flowContractAddress?: string;
  /** KV probe timeout in ms (default: 3000) */
  kvProbeTimeoutMs?: number;
}

const DEFAULT_STREAM_ID =
  '0x000000000000000000000000000000000000000000000000636c617767756172';
const DEFAULT_FLOW_CONTRACT = '0x22E03a6A89B950F1c82ec5e74F8eCa321a105296';
const DEFAULT_KV_PORT = 6789;
const DEFAULT_PROBE_TIMEOUT = 3000;

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.replace('0x', '').padStart(64, '0').slice(0, 64);
  return new Uint8Array(Buffer.from(clean, 'hex'));
}

// ─── Dynamic KV Node Discovery ────────────────────────────────────────────────

/**
 * Probes a single host:port for a KV JSON-RPC response.
 * Returns true if the node answers kv_getHoldingStreamIds within timeout.
 */
function probeKvNode(host: string, port: number, timeoutMs: number): Promise<boolean> {
  return new Promise(resolve => {
    const body = JSON.stringify({
      jsonrpc: '2.0',
      method: 'kv_getHoldingStreamIds',
      params: ['0x0000000000000000000000000000000000000000000000000000000000000001'],
      id: 1,
    });
    const opts: http.RequestOptions = {
      hostname: host,
      port,
      path: '/',
      method: 'POST',
      timeout: timeoutMs,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    };
    const req = http.request(opts, res => {
      res.resume(); // drain
      // Any HTTP response means the KV node is alive
      resolve(res.statusCode !== undefined);
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
    req.write(body);
    req.end();
  });
}

/**
 * Discovers a reachable KV node by:
 * 1. Asking the indexer for all known storage nodes
 * 2. Probing each node's host on port 6789 in parallel
 * 3. Returning the first one that responds
 *
 * Falls back to the configured kvNodeRpc if discovery fails.
 */
async function discoverKvNode(
  indexerRpc: string,
  fallback: string,
  timeoutMs: number,
): Promise<string> {
  const { Indexer } = sdk();
  let nodes: { trusted?: Array<{ url: string }>; discovered?: Array<{ url: string }> };

  try {
    const indexer = new Indexer(indexerRpc);
    nodes = await indexer.getShardedNodes();
  } catch {
    console.warn('[0G KV] Could not fetch node list from indexer, using configured endpoint.');
    return fallback;
  }

  const all = [...(nodes.trusted ?? []), ...(nodes.discovered ?? [])];

  // Extract unique hostnames from storage node URLs (they run on :5678 for storage)
  // KV runs on the same host, port 6789
  const hosts = [...new Set(
    all
      .map(n => {
        try { return new URL(n.url).hostname; } catch { return null; }
      })
      .filter((h): h is string => h !== null),
  )];

  console.log(`[0G KV] Probing ${hosts.length} nodes for KV service on port ${DEFAULT_KV_PORT}...`);

  // Probe all in parallel, pick first winner
  const results = await Promise.all(
    hosts.map(async host => {
      const ok = await probeKvNode(host, DEFAULT_KV_PORT, timeoutMs);
      return { host, ok };
    }),
  );

  const winner = results.find(r => r.ok);
  if (winner) {
    const url = `http://${winner.host}:${DEFAULT_KV_PORT}`;
    console.log(`[0G KV] ✅ Found reachable KV node: ${url}`);
    return url;
  }

  console.warn(`[0G KV] No reachable KV node found via discovery. Falling back to: ${fallback}`);
  return fallback;
}

// ─── ZGStorageClient ──────────────────────────────────────────────────────────

export class ZGStorageClient {
  private readonly rpcUrl: string;
  private readonly indexerRpc: string;
  private readonly kvNodeRpcHint: string;
  private readonly privateKey: string;
  private readonly streamIdBytes: Uint8Array; // for Batcher (binary format)
  private readonly streamIdHex: string;        // for KvClient (0x hex string format)

  private readonly flowContractAddress: string;
  private readonly kvProbeTimeoutMs: number;

  /** Cached discovered KV endpoint (populated on first use) */
  private resolvedKvNode: string | null = null;

  constructor(config: ZGStorageConfig) {
    this.rpcUrl = config.rpcUrl;
    this.indexerRpc = config.indexerRpc;
    this.kvNodeRpcHint = config.kvNodeRpc ?? `http://3.101.147.150:${DEFAULT_KV_PORT}`;
    this.privateKey = config.privateKey;
    this.streamIdBytes = hexToBytes(config.streamId ?? DEFAULT_STREAM_ID);
    this.streamIdHex = '0x' + (config.streamId ?? DEFAULT_STREAM_ID).replace('0x', '').padStart(64, '0').slice(0, 64);
    this.flowContractAddress = config.flowContractAddress ?? DEFAULT_FLOW_CONTRACT;
    this.kvProbeTimeoutMs = config.kvProbeTimeoutMs ?? DEFAULT_PROBE_TIMEOUT;
  }

  private getSigner(): ethers.Wallet {
    const provider = new ethers.JsonRpcProvider(this.rpcUrl);
    return new ethers.Wallet(this.privateKey, provider);
  }

  /**
   * Returns a reachable KV node URL, discovering one if needed.
   * Result is cached for the lifetime of this client instance.
   */
  private async getKvNode(): Promise<string> {
    if (this.resolvedKvNode) return this.resolvedKvNode;
    this.resolvedKvNode = await discoverKvNode(
      this.indexerRpc,
      this.kvNodeRpcHint,
      this.kvProbeTimeoutMs,
    );
    return this.resolvedKvNode;
  }

  // ── KV Manifest Store ─────────────────────────────────────────────────────

  /**
   * Publishes a CapabilityManifest to 0G Storage KV.
   * Key: `skill:{skillId}:manifest`
   * @returns storageKey — the KV key (used as storageAddress in SkillRegistry)
   */
  async publishManifest(manifest: CapabilityManifest): Promise<{ storageKey: string; txHash: string }> {
    const { Indexer, Batcher, getFlowContract } = sdk();

    const storageKey = `skill:${manifest.skillId}:manifest`;
    const keyBytes = Uint8Array.from(Buffer.from(storageKey, 'utf-8'));
    const valueBytes = Uint8Array.from(Buffer.from(JSON.stringify(manifest), 'utf-8'));

    const signer = this.getSigner();
    const indexer = new Indexer(this.indexerRpc);
    const [nodes, nodeErr] = await indexer.selectNodes(1);
    if (nodeErr !== null) throw new Error(`0G: Failed to select storage nodes: ${nodeErr}`);

    // getFlowContract(contractAddress, signer) — contract address first
    const flowContract = await getFlowContract(this.flowContractAddress, signer);
    const batcher = new Batcher(1, nodes, flowContract, this.rpcUrl);
    batcher.streamDataBuilder.set(this.streamIdBytes, keyBytes, valueBytes);

    const [tx, batchErr] = await batcher.exec();
    if (batchErr !== null) throw new Error(`0G KV write failed: ${batchErr}`);

    const txHash = (tx as { txHash?: string })?.txHash ?? String(tx);
    console.log(`[0G Storage] Manifest published. Key: ${storageKey} | Tx: ${txHash}`);
    return { storageKey, txHash };
  }

  /**
   * Fetches a CapabilityManifest from 0G Storage KV.
   * Uses dynamic KV node discovery (Option A) — never hard-fails on a single unreachable node.
   *
   * @param skillId      - The skill to fetch
   * @param expectedHash - Optional on-chain hash for tamper detection (Rule S-03)
   */
  async fetchManifest(skillId: string, expectedHash?: string): Promise<CapabilityManifest> {
    const { KvClient } = sdk();

    const storageKey = `skill:${skillId}:manifest`;
    const keyBytes = Uint8Array.from(Buffer.from(storageKey, 'utf-8'));

    // Dynamic discovery: find a reachable KV node
    const kvNodeUrl = await this.getKvNode();
    const kvClient = new KvClient(kvNodeUrl);

    // KvClient JSON-RPC passes streamId directly in params
    // — must be 0x hex string (not Uint8Array)
    const value = await kvClient.getValue(this.streamIdHex, keyBytes);

    // Guard: null, undefined, or empty response all mean the key is not in KV
    const isEmpty = (v: unknown): boolean => {
      if (v === null || v === undefined || v === '') return true;
      if (typeof v === 'object' && 'data' in v) {
        const d = (v as { data: string }).data;
        return d === '' || d === null || d === undefined;
      }
      return false;
    };

    if (isEmpty(value)) {
      throw new Error(
        `MANIFEST_NOT_PUBLISHED: No manifest found in 0G KV for skill "${skillId}".\n` +
        `  Key checked : ${storageKey}\n` +
        `  KV node     : ${kvNodeUrl}\n\n` +
        `  → Publish the manifest first:\n` +
        `    npx ts-node -r tsconfig-paths/register --project packages/cli/tsconfig.json --transpile-only packages/cli/src/index.ts publish packages/example-agent/skills/${skillId}`,
      );
    }

    // Decode response — KvClient returns { data: string (base64) }
    let raw: Buffer;
    if (typeof value === 'object' && 'data' in value && typeof (value as { data: string }).data === 'string') {
      raw = Buffer.from((value as { data: string }).data, 'base64');
      if (raw.length === 0) {
        throw new Error(
          `MANIFEST_NOT_PUBLISHED: Manifest key exists but has no data for skill "${skillId}".\n` +
          `  → Run: npx ts-node -r tsconfig-paths/register --project packages/cli/tsconfig.json --transpile-only packages/cli/src/index.ts publish packages/example-agent/skills/${skillId}`,
        );
      }
    } else if (value instanceof Uint8Array) {
      raw = Buffer.from(value);
    } else if (typeof value === 'string') {
      raw = Buffer.from(value, 'utf-8');
    } else {
      raw = Buffer.from(String(value), 'utf-8');
    }

    const manifest = JSON.parse(raw.toString('utf-8')) as CapabilityManifest;

    // Rule S-03: verify hash integrity
    if (expectedHash) {
      const actualHash = hashManifest(manifest);
      if (actualHash !== expectedHash) {
        throw new Error(
          `MANIFEST_TAMPERED: hash mismatch for skill "${skillId}". ` +
          `Expected: ${expectedHash} | Got: ${actualHash}`,
        );
      }
    }

    return manifest;
  }


  // ── Violation Audit Log ───────────────────────────────────────────────────

  /**
   * Logs a ViolationEvent to 0G Storage as a tamper-proof immutable file.
   * @returns rootHash — content-addressable ID (viewable on StorageScan)
   */
  async logViolation(event: ViolationEvent): Promise<string> {
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
    if (treeErr !== null) throw new Error(`0G: Merkle tree error: ${treeErr}`);

    const rootHash = tree?.rootHash() ?? 'unknown';
    const signer = this.getSigner();
    const indexer = new Indexer(this.indexerRpc);

    const [, uploadErr] = await indexer.upload(memData, this.rpcUrl, signer);
    if (uploadErr !== null) throw new Error(`0G: Violation log upload failed: ${uploadErr}`);

    console.log(`[0G Storage] Violation logged.`);
    console.log(`  Root hash : ${rootHash}`);
    console.log(`  View at   : https://storagescan-galileo.0g.ai/tx/${rootHash}`);
    return rootHash;
  }
}

// ─── Factory from environment variables ──────────────────────────────────────

/**
 * Creates a ZGStorageClient from environment variables.
 * ZG_KV_NODE_RPC is now optional — if absent, dynamic discovery is used.
 */
export function createStorageClientFromEnv(): ZGStorageClient {
  const required: Record<string, string | undefined> = {
    ZG_CHAIN_RPC: process.env['ZG_CHAIN_RPC'],
    ZG_INDEXER_RPC: process.env['ZG_INDEXER_RPC'],
    ZG_PRIVATE_KEY: process.env['ZG_PRIVATE_KEY'],
  };

  const missing = Object.entries(required)
    .filter(([, v]) => !v || v.includes('YOUR_PRIVATE_KEY'))
    .map(([k]) => k);

  if (missing.length > 0) {
    throw new Error(
      `Missing required env vars for 0G Storage: ${missing.join(', ')}\n` +
      `Copy .env.example to .env and fill in the values.`,
    );
  }

  return new ZGStorageClient({
    rpcUrl: required['ZG_CHAIN_RPC']!,
    indexerRpc: required['ZG_INDEXER_RPC']!,
    // ZG_KV_NODE_RPC is optional — falls back to dynamic discovery
    kvNodeRpc: process.env['ZG_KV_NODE_RPC'],
    privateKey: required['ZG_PRIVATE_KEY']!,
    streamId: process.env['ZG_STREAM_ID'],
    flowContractAddress: process.env['ZG_FLOW_CONTRACT'],
  });
}
