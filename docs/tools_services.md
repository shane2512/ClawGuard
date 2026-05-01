# ClawGuard — Tools & Services Reference

> This document is the single source of truth for every external tool, SDK, API, and service used in ClawGuard.  
> **Rule:** Before implementing any integration, read the linked official docs first. MCP server links are provided where available for in-context reference during implementation.

---

## 1. 0G Protocol Stack

All four 0G components are used. Each serves a distinct, non-interchangeable role.

---

### 1.1 0G Storage — Key-Value (Manifest Store)

| Property | Value |
|----------|-------|
| **Purpose** | Store CapabilityManifest JSON blobs, keyed by skill ID |
| **Access pattern** | Write-once on publish, read-many at runtime |
| **SDK** | `@0glabs/0g-ts-sdk` |
| **Install** | `npm install @0glabs/0g-ts-sdk` |

**Official Docs:**
- Storage overview: https://docs.0g.ai/build-with-0g/storage-sdk
- KV store API: https://docs.0g.ai/build-with-0g/storage-sdk/kv-store
- TypeScript examples: https://github.com/0glabs/0g-ts-sdk/tree/main/examples

**MCP Server Reference (read before implementing):**
> Install the 0G MCP server and use it to query the KV store docs interactively during development.  
> MCP server: https://github.com/0glabs/0g-mcp  
> Run: `npx @0glabs/0g-mcp` — then query `0g_storage_kv_set`, `0g_storage_kv_get`

**Key operations used in ClawGuard:**

```typescript
import { ZgFile, Indexer } from '@0glabs/0g-ts-sdk';

// Write manifest
const kv = new KVStore(rpcEndpoint, privateKey);
await kv.set(`skill:${skillId}:manifest`, JSON.stringify(manifest));

// Read manifest
const raw = await kv.get(`skill:${skillId}:manifest`);
const manifest = JSON.parse(raw);
```

**Environment variables needed:**
```env
ZG_STORAGE_RPC=https://rpc-storage-testnet.0g.ai
ZG_PRIVATE_KEY=0x...
```

---

### 1.2 0G Storage — Log (Violation Audit Trail)

| Property | Value |
|----------|-------|
| **Purpose** | Append-only, tamper-proof log of every blocked tool call |
| **Access pattern** | Append on violation, query for audit/demo |
| **SDK** | `@0glabs/0g-ts-sdk` (same package, different API) |

**Official Docs:**
- Log store API: https://docs.0g.ai/build-with-0g/storage-sdk/log-store
- Log stream concepts: https://docs.0g.ai/build-with-0g/storage-sdk/log-store#streams

**MCP Server Reference:**
> Same MCP server as above.  
> Query: `0g_storage_log_append`, `0g_storage_log_query`

**Key operations used in ClawGuard:**

```typescript
// Append violation event
const log = new LogStore(rpcEndpoint, privateKey);
await log.append('clawguard:violations', JSON.stringify(violationEvent));

// Query violations for a skill
const events = await log.query('clawguard:violations', { 
  filter: (e) => JSON.parse(e).skillId === skillId 
});
```

---

### 1.3 0G Chain (SkillRegistry Smart Contract)

| Property | Value |
|----------|-------|
| **Purpose** | Immutable on-chain registry of skill manifests + verification status |
| **Network** | 0G Chain Testnet |
| **Chain ID** | Check https://docs.0g.ai/build-with-0g/chain |
| **RPC** | https://rpc-testnet.0g.ai (verify in docs — may change) |
| **Explorer** | https://explorer.0g.ai |
| **Faucet** | https://faucet.0g.ai |
| **Toolchain** | Foundry (`forge`, `cast`, `anvil`) |

**Official Docs:**
- 0G Chain overview: https://docs.0g.ai/build-with-0g/chain
- Deploying contracts: https://docs.0g.ai/build-with-0g/chain/deploying-contracts
- Foundry guide: https://book.getfoundry.sh/

**MCP Server Reference:**
> Use the 0G MCP server to query chain state, read contract ABIs, and verify transactions during development.  
> MCP server: https://github.com/0glabs/0g-mcp  
> Query: `0g_chain_get_transaction`, `0g_chain_call_contract`

**Contract deployment commands:**
```bash
# Install Foundry
curl -L https://foundry.paradigm.xyz | bash && foundryup

# Compile
forge build

# Deploy to 0G testnet
forge script script/Deploy.s.sol:DeployScript \
  --rpc-url $ZG_CHAIN_RPC \
  --private-key $ZG_PRIVATE_KEY \
  --broadcast \
  --verify

# Interact via cast
cast call $REGISTRY_ADDRESS "getSkillRecord(bytes32)" $SKILL_ID \
  --rpc-url $ZG_CHAIN_RPC
```

**Environment variables needed:**
```env
ZG_CHAIN_RPC=https://rpc-testnet.0g.ai
ZG_CHAIN_ID=<check docs>
REGISTRY_ADDRESS=<filled after deployment>
```

---

### 1.4 0G Compute — Sealed Inference (Capability Verification)

| Property | Value |
|----------|-------|
| **Purpose** | TEE-based AI analysis of skill code to extract capability fingerprint |
| **Models** | `qwen3.6-plus` (preferred) or `GLM-5-FP8` |
| **Why sealed** | Cryptographic proof that the AI analysis was not tampered with |

**Official Docs:**
- Compute overview: https://docs.0g.ai/build-with-0g/compute-network
- Inference API: https://docs.0g.ai/build-with-0g/compute-network/inference
- Model list: https://docs.0g.ai/build-with-0g/compute-network/models

**MCP Server Reference (CRITICAL — read before implementing):**
> Install the 0G MCP server to test inference calls interactively before writing production code.  
> MCP server: https://github.com/0glabs/0g-mcp  
> Query: `0g_compute_inference` — test with your verification prompt before hardcoding it

**Verification prompt template:**
```
Analyze this OpenClaw skill code and return ONLY a valid JSON object with no explanation, 
no markdown, no preamble. The JSON must have exactly one key: "invokedTools" whose value 
is an array of strings — each string is the exact tool name called in the code.

Code:
{SKILL_CODE}
```

**Key implementation:**
```typescript
import { ComputeClient } from '@0glabs/0g-ts-sdk';

const compute = new ComputeClient(computeEndpoint, privateKey);
const response = await compute.infer({
  model: 'qwen3.6-plus',
  messages: [{ role: 'user', content: verificationPrompt }],
  sealed: true,  // enable TEE
});

const fingerprint = JSON.parse(response.content);
// fingerprint.invokedTools: string[]
```

---

## 2. ENS (Ethereum Name Service)

| Property | Value |
|----------|-------|
| **Purpose** | Human-readable skill identity + capability discovery layer |
| **SDK** | `@ensdomains/ensjs` v4+ |
| **Install** | `npm install @ensdomains/ensjs viem` |
| **Network** | Ethereum mainnet or Sepolia testnet |

**Official Docs:**
- ENS docs: https://docs.ens.domains/
- Building with AI agents: https://docs.ens.domains/building-with-ai/
- Subname manager: https://docs.ens.domains/web/subnames
- Text records: https://docs.ens.domains/ensip/5
- ensjs v4 API: https://github.com/ensdomains/ensjs

**MCP Server Reference:**
> ENS does not currently have an official MCP server, but you can use the ENS public resolver contract directly via viem.  
> Refer to: https://docs.ens.domains/resolvers/public before implementing text record writes.

**Key operations used in ClawGuard:**

```typescript
import { createEnsPublicClient } from '@ensdomains/ensjs';
import { http } from 'viem';
import { mainnet, sepolia } from 'viem/chains';

const client = createEnsPublicClient({
  chain: sepolia,  // use sepolia for hackathon testing
  transport: http(),
});

// Read text record
const manifestAddress = await client.getTextRecord({
  name: 'defi-reader.skills.clawhub.eth',
  key: 'capability-manifest',
});

// Resolve address
const address = await client.getAddressRecord({
  name: 'defi-reader.skills.clawhub.eth',
});
```

**Writing text records (requires wallet):**
```typescript
import { createWalletClient } from 'viem';
import { setText } from '@ensdomains/ensjs/wallet';

const walletClient = createWalletClient({ ... });

await setText(walletClient, {
  name: 'defi-reader.skills.clawhub.eth',
  key: 'capability-manifest',
  value: `0g-kv://skill:${skillId}:manifest`,
});
```

**Text record keys used by ClawGuard:**

| Key | Value format | Example |
|-----|-------------|---------|
| `capability-manifest` | `0g-kv://skill:{skillId}:manifest` | `0g-kv://skill:abc123:manifest` |
| `verification-status` | `VERIFIED` or `CAPABILITY_MISMATCH` | `VERIFIED` |
| `registry-contract` | `0x{address}` on 0G Chain | `0x1234...` |
| `skill-version` | semver string | `1.0.0` |

**ENS subname naming convention:**
```
{skill-slug}.skills.clawhub.eth
```
Examples: `defi-reader.skills.clawhub.eth`, `price-oracle.skills.clawhub.eth`

---

## 3. OpenClaw Framework

| Property | Value |
|----------|-------|
| **Repo** | https://github.com/openclaw/openclaw (check ETHGlobal builder hub for canonical URL) |
| **Install** | `npm install openclaw` |
| **Key hook** | `tool_dispatch` — this is what ClawGuard wraps |

**Official Docs:**
- Builder Hub: https://build.0g.ai
- OpenClaw architecture: 4 layers (Gateway → Agent System → Tool Integration → Memory)
- SKILL.md format: documented in OpenClaw README

**ClawGuard's integration point:**
```typescript
import { createAgent } from 'openclaw';
import { wrapWithClawGuard } from '@clawguard/core';

const agent = createAgent({ soul: './SOUL.md' });

// This is the ONLY change needed to enable ClawGuard
agent.tool_dispatch = wrapWithClawGuard(agent.tool_dispatch, {
  registryAddress: process.env.REGISTRY_ADDRESS,
  zgStorageRpc: process.env.ZG_STORAGE_RPC,
  failOpen: false,  // fail-closed (deny) on manifest fetch error
});
```

---

## 4. Supporting Libraries

| Library | Version | Purpose | Install |
|---------|---------|---------|---------|
| `viem` | ^2.0 | Ethereum interactions for ENS + 0G Chain | `npm i viem` |
| `lru-cache` | ^10.0 | In-memory manifest cache (TTL-based) | `npm i lru-cache` |
| `js-sha256` | ^0.11 | Manifest hash computation | `npm i js-sha256` |
| `js-yaml` | ^4.0 | Parse SKILL.md YAML blocks | `npm i js-yaml` |
| `chalk` | ^5.0 | Terminal output colors for demo | `npm i chalk` |
| `commander` | ^11.0 | CLI argument parsing | `npm i commander` |
| `zod` | ^3.0 | Runtime schema validation for manifests | `npm i zod` |
| `vitest` | ^1.0 | Unit testing | `npm i -D vitest` |
| `typescript` | ^5.0 | Type safety throughout | `npm i -D typescript` |

---

## 5. Development Environment

### Node.js
- **Version:** 20 LTS (required by most 0G SDK examples)
- **Package manager:** pnpm (monorepo workspaces)
- Install pnpm: `npm install -g pnpm`

### Foundry (Solidity)
- Install: `curl -L https://foundry.paradigm.xyz | bash && foundryup`
- Solidity version: `^0.8.24`

### Environment File Template

Create `.env` at monorepo root:
```env
# 0G Chain
ZG_CHAIN_RPC=https://rpc-testnet.0g.ai
ZG_CHAIN_ID=
ZG_PRIVATE_KEY=0x

# 0G Storage
ZG_STORAGE_RPC=https://rpc-storage-testnet.0g.ai

# 0G Compute
ZG_COMPUTE_ENDPOINT=https://compute-testnet.0g.ai

# Deployed contracts
REGISTRY_ADDRESS=

# ENS
ENS_NETWORK=sepolia
ENS_PARENT_NAME=clawhub.eth
```

> ⚠️ **Never commit `.env` to Git.** Add it to `.gitignore` immediately.

---

## 6. MCP Server Setup Summary

> **Rule from RULES_AND_GUIDELINES.md:** Before implementing any 0G integration, install and query the 0G MCP server to read the live API documentation in context.

### Install 0G MCP Server
```bash
# Via npx (no install needed)
npx @0glabs/0g-mcp

# Or clone and run
git clone https://github.com/0glabs/0g-mcp
cd 0g-mcp && npm install && npm start
```

### Queries to run before each phase
| Before implementing | Run this MCP query |
|--------------------|--------------------|
| 0G Storage KV | `What is the KV store set/get API signature?` |
| 0G Storage Log | `How do I append to a log stream and query it?` |
| 0G Chain contract | `What are the RPC endpoints for 0G testnet?` |
| 0G Compute inference | `What is the inference API request format for qwen3.6-plus?` |

### ENS Reference (no MCP — use docs directly)
- Before ENS subname write: read https://docs.ens.domains/web/subnames
- Before text record write: read https://docs.ens.domains/ensip/5
- Before AI agent integration: read https://docs.ens.domains/building-with-ai/