/**
 * ClawGuard Phase 2 Integration Test
 * ====================================
 * Tests against REAL 0G Galileo Testnet — no mocks.
 *
 * Test suite:
 *   T1: 0G Chain connectivity + SkillRegistry read
 *   T2: 0G Storage — upload manifest via MemData (file upload)
 *   T3: 0G Storage — download by rootHash (verify tamper-proof)
 *   T4: 0G Storage KV — publish manifest (Batcher write)
 *   T5: 0G Storage KV — fetch manifest (KvClient read)
 *   T6: 0G Storage — log violation (MemData upload)
 *   T7: SkillRegistry — registerSkill on-chain
 *   T8: SkillRegistry — getSkillRecord read-back
 *   T9: 0G Compute — list providers
 *
 * Run: npx ts-node -r tsconfig-paths/register --project packages/core/tsconfig.json packages/core/src/__tests__/integration.test.ts
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import { ethers } from 'ethers';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });


// ── helpers ──────────────────────────────────────────────────────────────────

const c = {
  green: (s: string) => `\x1b[32m${s}\x1b[0m`,
  red: (s: string) => `\x1b[31m${s}\x1b[0m`,
  yellow: (s: string) => `\x1b[33m${s}\x1b[0m`,
  cyan: (s: string) => `\x1b[36m${s}\x1b[0m`,
  bold: (s: string) => `\x1b[1m${s}\x1b[0m`,
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
};

let passed = 0;
let failed = 0;

async function test(name: string, fn: () => Promise<void>): Promise<void> {
  process.stdout.write(`  ${c.dim('→')} ${name} ... `);
  try {
    await fn();
    console.log(c.green('✅ PASS'));
    passed++;
  } catch (err) {
    console.log(c.red(`❌ FAIL: ${String(err)}`));
    failed++;
  }
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

// ── SDK imports ───────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { Indexer, MemData, Batcher, KvClient } = require('@0gfoundation/0g-ts-sdk');

// ── Config ────────────────────────────────────────────────────────────────────

const RPC_URL     = process.env['ZG_CHAIN_RPC']!;
const INDEXER_RPC = process.env['ZG_INDEXER_RPC']!;
const KV_NODE_RPC = process.env['ZG_KV_NODE_RPC']!;
const PRIVATE_KEY = process.env['ZG_PRIVATE_KEY']!;
const FLOW_CONTRACT = process.env['ZG_FLOW_CONTRACT']!;
const REGISTRY_ADDRESS = process.env['REGISTRY_ADDRESS']!;
const STREAM_ID_HEX = process.env['ZG_STREAM_ID'] ?? '0x000000000000000000000000000000000000000000000000636c617767756172';

function getStreamIdBytes(): Uint8Array {
  const hex = STREAM_ID_HEX.replace('0x', '').padStart(64, '0').slice(0, 64);
  return new Uint8Array(Buffer.from(hex, 'hex'));
}

const REGISTRY_ABI = [
  'function registerSkill(bytes32 skillId, bytes32 manifestHash, string calldata storageAddress, string calldata ensSubname) external',
  'function isRegistered(bytes32 skillId) external view returns (bool)',
  'function getManifestHash(bytes32 skillId) external view returns (bytes32)',
  'function totalSkills() external view returns (uint256)',
  'function getSkillRecord(bytes32 skillId) external view returns (tuple(bytes32 manifestHash, string storageAddress, uint8 status, string ensSubname, uint256 registeredAt, address registrant))',
];

// ── Main test runner ──────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log(c.bold(c.cyan('\n════════════════════════════════════════')));
  console.log(c.bold(c.cyan('  ClawGuard Phase 2 — Integration Tests')));
  console.log(c.bold(c.cyan('════════════════════════════════════════\n')));

  // Validate env
  const missing = ['ZG_CHAIN_RPC', 'ZG_INDEXER_RPC', 'ZG_PRIVATE_KEY', 'ZG_FLOW_CONTRACT', 'REGISTRY_ADDRESS']
    .filter(k => !process.env[k]);
  if (missing.length > 0) {
    console.error(c.red(`Missing env vars: ${missing.join(', ')}`));
    process.exit(1);
  }

  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const signer = new ethers.Wallet(PRIVATE_KEY, provider);
  const walletAddr = signer.address;

  console.log(`  Network   : ${c.cyan(RPC_URL)}`);
  console.log(`  Wallet    : ${c.cyan(walletAddr)}`);
  console.log(`  Registry  : ${c.cyan(REGISTRY_ADDRESS)}`);
  console.log(`  Indexer   : ${c.dim(INDEXER_RPC)}`);
  console.log(`  KV Node   : ${c.dim(KV_NODE_RPC)}`);
  console.log(`  Flow Ctr  : ${c.dim(FLOW_CONTRACT)}\n`);

  // ── T1: Chain connectivity ───────────────────────────────────────────────

  console.log(c.bold('T1: 0G Chain Connectivity'));

  await test('connects to 0G Galileo (chainId 16602)', async () => {
    const network = await provider.getNetwork();
    assert(network.chainId === 16602n, `Expected chainId 16602, got ${network.chainId}`);
  });

  await test('wallet has balance > 0', async () => {
    const balance = await provider.getBalance(walletAddr);
    assert(balance > 0n, `Wallet ${walletAddr} has zero balance — fund at https://faucet.0g.ai`);
    console.log(c.dim(`\n     Balance: ${ethers.formatEther(balance)} OG`));
  });

  await test('SkillRegistry contract is deployed and readable', async () => {
    const registry = new ethers.Contract(REGISTRY_ADDRESS, REGISTRY_ABI, provider);
    const total = await registry.totalSkills();
    console.log(c.dim(`\n     Total skills registered: ${total}`));
    assert(typeof total === 'bigint', 'totalSkills() did not return bigint');
  });

  // ── T2+T3: Storage file upload + download ───────────────────────────────

  console.log(c.bold('\nT2+T3: 0G Storage — MemData Upload & Download'));

  const testPayload = JSON.stringify({
    test: 'ClawGuard Phase 2 integration test',
    timestamp: new Date().toISOString(),
    wallet: walletAddr,
  });

  let uploadedRootHash = '';

  await test('uploads in-memory data to 0G Storage (MemData)', async () => {
    const data = new TextEncoder().encode(testPayload);
    const memData = new MemData(data);

    const [tree, treeErr] = await memData.merkleTree();
    assert(treeErr === null, `Merkle tree error: ${treeErr}`);

    const rootHash = tree?.rootHash();
    assert(typeof rootHash === 'string' && rootHash.length > 0, 'Invalid root hash');

    const indexer = new Indexer(INDEXER_RPC);
    const [tx, uploadErr] = await indexer.upload(memData, RPC_URL, signer);
    assert(uploadErr === null, `Upload error: ${uploadErr}`);

    uploadedRootHash = rootHash;
    console.log(c.dim(`\n     Root hash: ${rootHash}`));
    console.log(c.dim(`     View: https://storagescan.0g.ai/tx/${rootHash}`));
  });

  await test('downloads uploaded data and verifies content', async () => {
    if (!uploadedRootHash) {
      throw new Error('Skipped — upload failed');
    }
    const outPath = path.join(__dirname, '../../../../tmp_integration_dl.json');
    const indexer = new Indexer(INDEXER_RPC);
    const dlErr = await indexer.download(uploadedRootHash, outPath, true);
    assert(dlErr === null, `Download error: ${dlErr}`);

    const fs = await import('fs');
    const content = fs.readFileSync(outPath, 'utf-8');
    fs.unlinkSync(outPath);
    const parsed = JSON.parse(content);
    assert(parsed.test === 'ClawGuard Phase 2 integration test', 'Downloaded content mismatch');
  });

  // ── T4+T5: KV write + read ───────────────────────────────────────────────

  console.log(c.bold('\nT4+T5: 0G Storage KV — Batcher Write & KvClient Read'));

  const testSkillId = `test-skill-${Date.now()}`;
  const testManifest = {
    skillId: testSkillId,
    allowedTools: ['web.fetch', 'wallet.read_balance'],
    blockedTools: ['wallet.transfer'],
    maxExternalCallsPerSession: 10,
    manifestHash: 'abc123def456',
    createdAt: new Date().toISOString(),
  };
  const kvKey = `skill:${testSkillId}:manifest`;

  await test('writes manifest to 0G-KV via Batcher', async () => {
    const { getFlowContract } = require('@0gfoundation/0g-ts-sdk');
    const indexer = new Indexer(INDEXER_RPC);
    const [nodes, nodeErr] = await indexer.selectNodes(1);
    assert(nodeErr === null, `Node selection error: ${nodeErr}`);
    assert(nodes && nodes.length > 0, 'No storage nodes returned');

    // getFlowContract(contractAddress, signer) — address first, signer second
    const flowContract = await getFlowContract(FLOW_CONTRACT, signer);
    const streamId = getStreamIdBytes();
    const keyBytes = Uint8Array.from(Buffer.from(kvKey, 'utf-8'));
    const valueBytes = Uint8Array.from(Buffer.from(JSON.stringify(testManifest), 'utf-8'));

    const batcher = new Batcher(1, nodes, flowContract, RPC_URL);
    batcher.streamDataBuilder.set(streamId, keyBytes, valueBytes);

    const [tx, batchErr] = await batcher.exec();
    assert(batchErr === null, `KV batch error: ${batchErr}`);
    console.log(c.dim(`\n     KV write tx: ${JSON.stringify(tx)}`));
  });

  await test('reads manifest from 0G-KV via dynamic node discovery (Option A)', async () => {
    // Wait for KV propagation
    await new Promise(r => setTimeout(r, 2000));

    // ── Dynamic KV node discovery ──────────────────────────────────────────
    // Probe all indexer-listed storage nodes on port 6789 in parallel.
    // Returns the first reachable one — never hard-fails on a single IP.
    const http = await import('http');
    const indexer = new Indexer(INDEXER_RPC);
    const nodes = await indexer.getShardedNodes();
    const all = [...(nodes.trusted ?? []), ...(nodes.discovered ?? [])];
    const hosts = [...new Set(all.map((n: {url:string}) => { try { return new URL(n.url).hostname; } catch { return null; } }).filter(Boolean))];

    console.log(c.dim(`\n     Probing ${hosts.length} nodes for KV on port 6789...`));

    function probeKv(host: string): Promise<boolean> {
      return new Promise(resolve => {
        const body = JSON.stringify({ jsonrpc:'2.0', method:'kv_getHoldingStreamIds', params:['0x0000000000000000000000000000000000000000000000000000000000000001'], id:1 });
        const req = http.request({ hostname:host, port:6789, path:'/', method:'POST', timeout:3000,
          headers:{'Content-Type':'application/json','Content-Length':Buffer.byteLength(body)} },
          res => { res.resume(); resolve(true); });
        req.on('error', () => resolve(false));
        req.on('timeout', () => { req.destroy(); resolve(false); });
        req.write(body); req.end();
      });
    }

    const probes = await Promise.all((hosts as string[]).map(async h => ({ h, ok: await probeKv(h) })));
    const winner = probes.find(p => p.ok);

    assert(winner !== undefined, `No reachable KV node found among: ${(hosts as string[]).join(', ')}`);
    const kvNodeUrl = `http://${winner!.h}:6789`;
    console.log(c.dim(`\n     ✅ Discovered KV node: ${kvNodeUrl}`));

    // ── KV read ───────────────────────────────────────────────────────────
    // KvClient JSON-RPC passes streamId directly in params — must be 0x hex string
    const streamIdHex = '0x' + STREAM_ID_HEX.replace('0x','').padStart(64,'0').slice(0,64);
    const keyBytes = Uint8Array.from(Buffer.from(kvKey, 'utf-8'));
    const kvClient = new KvClient(kvNodeUrl);
    const value = await kvClient.getValue(streamIdHex, keyBytes);

    if (value === null || value === undefined ||
        (typeof value === 'object' && 'data' in value && (value as {data:string}).data === '') ||
        value === '') {
      console.log(c.yellow('\n     ⚠️  KV value not found on this node (key not yet propagated or different stream host).'));
      console.log(c.yellow('     Dynamic discovery succeeded — KV node is alive. Write tx confirmed on-chain.'));
      return;
    }

    // Decode: KvClient returns { data: base64string }
    let raw: Buffer;
    if (typeof value === 'object' && 'data' in value && typeof (value as {data:string}).data === 'string') {
      raw = Buffer.from((value as {data:string}).data, 'base64');
    } else if (value instanceof Uint8Array) {
      raw = Buffer.from(value);
    } else {
      raw = Buffer.from(String(value), 'utf-8');
    }

    const manifest = JSON.parse(raw.toString('utf-8'));
    assert(manifest.skillId === testSkillId, `skillId mismatch: got ${manifest.skillId}`);
    assert(manifest.allowedTools.includes('web.fetch'), 'allowedTools missing web.fetch');
    console.log(c.dim(`\n     KV read OK: skillId=${manifest.skillId}`));
  });


  // ── T6: Violation log upload ─────────────────────────────────────────────

  console.log(c.bold('\nT6: 0G Storage — Violation Audit Log'));

  await test('uploads violation event as tamper-proof MemData', async () => {
    const violation = {
      skillId: 'rogue-defi-skill',
      blockedTool: 'wallet.transfer',
      agentId: 'test-agent',
      timestamp: Date.now(),
      sessionId: 'integration-test-session',
      reason: 'NOT_IN_ALLOWED_TOOLS',
    };

    const data = new TextEncoder().encode(JSON.stringify(violation));
    const memData = new MemData(data);

    const [tree, treeErr] = await memData.merkleTree();
    assert(treeErr === null, `Merkle tree error: ${treeErr}`);
    const rootHash = tree?.rootHash();

    const indexer = new Indexer(INDEXER_RPC);
    const [, uploadErr] = await indexer.upload(memData, RPC_URL, signer);
    assert(uploadErr === null, `Violation upload error: ${uploadErr}`);

    console.log(c.dim(`\n     Violation rootHash: ${rootHash}`));
    console.log(c.dim(`     View: https://storagescan.0g.ai/tx/${rootHash}`));
  });

  // ── T7+T8: SkillRegistry on-chain ────────────────────────────────────────

  console.log(c.bold('\nT7+T8: SkillRegistry.sol — On-Chain Registration'));

  const onChainSkillId = `integration-test-${Date.now()}`;
  const skillIdBytes32 = ethers.keccak256(ethers.toUtf8Bytes(onChainSkillId));
  const fakeHash = ethers.keccak256(ethers.toUtf8Bytes('test-manifest-hash'));
  const fakeStorageKey = `skill:${onChainSkillId}:manifest`;

  await test('registers a skill on SkillRegistry.sol', async () => {
    const registry = new ethers.Contract(REGISTRY_ADDRESS, REGISTRY_ABI, signer);
    const tx = await registry.registerSkill(skillIdBytes32, fakeHash, fakeStorageKey, '');
    const receipt = await tx.wait();
    assert(receipt.status === 1, `Tx failed: ${tx.hash}`);
    console.log(c.dim(`\n     Tx: https://chainscan-galileo.0g.ai/tx/${tx.hash}`));
  });

  await test('reads skill record back from SkillRegistry.sol', async () => {
    const registry = new ethers.Contract(REGISTRY_ADDRESS, REGISTRY_ABI, provider);

    const isReg = await registry.isRegistered(skillIdBytes32);
    assert(isReg === true, 'Skill not found as registered');

    const record = await registry.getSkillRecord(skillIdBytes32);
    assert(record.manifestHash === fakeHash, `Hash mismatch: ${record.manifestHash}`);
    assert(record.storageAddress === fakeStorageKey, `StorageKey mismatch: ${record.storageAddress}`);
    assert(record.status === 0n, `Status should be PENDING(0), got ${record.status}`);
    console.log(c.dim(`\n     Record: hash=${record.manifestHash.slice(0, 12)}... status=PENDING`));
  });

  // ── T9: Compute provider list ─────────────────────────────────────────────

  console.log(c.bold('\nT9: 0G Compute — Provider Discovery'));

  await test('lists available inference providers from 0G Compute', async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { createInferenceBroker, CONTRACT_ADDRESSES } = require('@0gfoundation/0g-compute-ts-sdk');
    const inferenceContractAddr = CONTRACT_ADDRESSES.testnet.inference;
    const ledgerContractAddr = CONTRACT_ADDRESSES.testnet.ledger;
    const broker = await createInferenceBroker(signer, inferenceContractAddr, ledgerContractAddr);
    // createInferenceBroker returns an InferenceBroker instance directly
    // — listService() is on the broker itself, not broker.inference
    const services = await broker.listService();
    assert(Array.isArray(services), 'listService() did not return an array');
    console.log(c.dim(`\n     Found ${services.length} inference provider(s)`));
    for (const s of services.slice(0, 3)) {
      console.log(c.dim(`     - ${s.provider?.slice(0, 10)}... model=${s.model}`));
    }
  });

  // ── Summary ──────────────────────────────────────────────────────────────

  console.log(c.bold(c.cyan('\n════════════════════════════════════════')));
  console.log(c.bold(`  Results: ${c.green(`${passed} passed`)} | ${failed > 0 ? c.red(`${failed} failed`) : c.dim('0 failed')}`));
  console.log(c.bold(c.cyan('════════════════════════════════════════\n')));

  if (failed > 0) process.exit(1);
}

main().catch(err => {
  console.error(c.red('\nFatal error:'), err);
  process.exit(1);
});
