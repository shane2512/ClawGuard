# ClawGuard 🛡️

> **Layer 2.5 Security Middleware for OpenClaw Agents**  
> Declarative capability enforcement · Tamper-proof audit logs · On-chain manifest registry · ENS skill discovery

[![0G Chain](https://img.shields.io/badge/0G%20Chain-Galileo%20Testnet-blue)](https://chainscan-galileo.0g.ai)
[![SkillRegistry](https://img.shields.io/badge/SkillRegistry-0x2205AC...010A-green)](https://chainscan-galileo.0g.ai/address/0x2205AC38725F42d9da0ffaDD94166B5E5b83010A)
[![ENS](https://img.shields.io/badge/ENS-clawhub.eth-purple)](https://app.ens.domains/clawhub.eth)
[![Tests](https://img.shields.io/badge/Tests-39%20passed-brightgreen)](#testing)

---

## What is ClawGuard?

ClawGuard is a **middleware security layer** that wraps any OpenClaw agent's `tool_dispatch` function and enforces a **declarative capability manifest** — stopping unauthorized tool calls before they execute, logging every violation to 0G's tamper-proof storage, and anchoring all skill identities to ENS.

```
OpenClaw Agent
     │
     ▼ tool_dispatch(tool, params)
┌────────────────────────────────────────┐
│           ClawGuard Middleware          │
│                                        │
│  ① Resolve manifest  ←── ENS subname  │
│      (skills.clawhub.eth)              │
│  ② Fetch from 0G Storage KV           │
│  ③ Verify hash (Rule S-03)            │
│  ④ Enforce allow/block lists          │
│  ⑤ Log violations → 0G Storage Log   │
└────────────────────────────────────────┘
     │ ✅ allowed                 │ 🚫 blocked
     ▼                            ▼
  Actual tool            ViolationEvent
  execution               (immutable)
```

---

## Architecture

```
ClawGuard/
├── packages/
│   ├── core/              # @clawguard/core — middleware, storage, ENS
│   │   └── src/
│   │       ├── manifest.ts     # SKILL.md parser + SHA-256 hashing
│   │       ├── middleware.ts   # wrapWithClawGuard() — main entry point
│   │       ├── storage.ts      # 0G Storage KV + file upload
│   │       └── ens.ts          # ENS resolution + subname registration
│   ├── contracts/         # Smart contracts + scripts
│   │   ├── src/
│   │   │   ├── SkillRegistry.sol     # On-chain manifest anchor
│   │   │   └── ENSRegistrar.ts       # ENS subname management CLI
│   │   └── deployments/
│   ├── cli/               # @clawguard/cli — developer toolchain
│   │   └── src/
│   │       ├── index.ts        # CLI entry point
│   │       ├── publish.ts      # publish: SKILL.md → 0G KV → Chain → ENS
│   │       ├── verify.ts       # verify: 0G Compute sealed inference
│   │       └── inspect.ts      # inspect: read manifest from ENS / 0G KV
│   └── example-agent/     # Demo agent with allowed + blocked skills
```

---

## Quick Start

### Prerequisites
- Node.js 18+
- A funded wallet (get testnet tokens below)

### 1. Install
```bash
git clone <repo>
cd ClawGuard
npm install
```

### 2. Configure `.env`
```bash
cp .env.example .env
# Fill in ZG_PRIVATE_KEY (must have OG tokens on 0G Galileo + ETH on Sepolia)
```

**Get testnet tokens:**
- 0G Galileo (OG): https://faucet.0g.ai — needed for storage + compute
- Sepolia (ETH): https://sepoliafaucet.com — needed for ENS registration

### 3. Bootstrap ENS (one-time)
```bash
# Creates skills.clawhub.eth subdomain under clawhub.eth
npx ts-node packages/contracts/src/ENSRegistrar.ts bootstrap
```

### 4. Publish a Skill
```bash
# Full pipeline: SKILL.md → 0G KV → SkillRegistry → ENS
npx ts-node packages/cli/src/index.ts publish \
  packages/example-agent/skills/defi-reader \
  --description "Read-only DeFi price monitoring agent"
```

This single command:
1. Parses `SKILL.md` and computes a SHA-256 manifest hash
2. Uploads the manifest to **0G Storage KV** (tamper-proof)
3. Anchors the hash on **SkillRegistry.sol** (0G Galileo Chain)
4. Registers `defi-reader.skills.clawhub.eth` with text records (Sepolia ENS)

### 5. Verify a Skill (0G Compute)
```bash
# Uses sealed Qwen inference to verify code matches declared capabilities
npx ts-node packages/cli/src/index.ts verify \
  packages/example-agent/skills/defi-reader
```

### 6. Inspect a Skill
```bash
# Resolve via ENS name
npx ts-node packages/cli/src/index.ts inspect defi-reader.skills.clawhub.eth

# Or directly from 0G Storage KV
npx ts-node packages/cli/src/index.ts inspect --skill defi-reader
```

---

## Using the Middleware

```typescript
import { wrapWithClawGuard } from '@clawguard/core';

// Your OpenClaw agent's tool dispatch function
const dispatch = wrapWithClawGuard(myAgent.tool_dispatch, {
  // Option A: load from 0G Storage (production)
  zgStorageRpc: process.env.ZG_INDEXER_RPC,
  zgPrivateKey: process.env.ZG_PRIVATE_KEY,

  // Option B: local manifest store (development)
  localManifestStore: {
    'defi-reader': myManifest,
  },

  // Fail-closed by default (blocks on manifest fetch failure)
  failOpen: false,

  // Violation handler — e.g. alert to Slack, store in DB
  onViolation: async (event) => {
    console.error('[SECURITY]', event.blockedTool, 'blocked for', event.skillId);
  },
});

// Every tool call now goes through ClawGuard
const result = await dispatch({
  tool: 'wallet.read_balance',
  params: { address: '0x...' },
  context: { skillId: 'defi-reader', sessionId: 'abc123' },
});
```

---

## SKILL.md Format

Every agent skill declares its capabilities in a `SKILL.md` file:

```markdown
# DeFi Reader

Read-only DeFi market data agent.

## Allowed Tools
- wallet.read_balance
- web.fetch
- data.parse_json

## Blocked Tools
- wallet.transfer
- wallet.sign_transaction
- shell.exec

## Constraints
- max_external_calls_per_session: 10
- require_user_confirmation: false
```

ClawGuard parses this file, computes a SHA-256 hash of the canonical form, and uses it to verify manifest integrity at runtime (Rule S-03).

---

## ENS Naming Scheme

```
{skillId}.skills.clawhub.eth
     │           │         │
  skill ID   subnode    parent
  (e.g.      (fixed)   (owned by
  defi-reader)          clawhub.eth)
```

Each ENS subname stores these text records:

| Key | Value | Purpose |
|-----|-------|---------|
| `clawguard.storageKey` | `skill:defi-reader:manifest` | 0G KV lookup key |
| `clawguard.manifestHash` | `0xabc...` | SHA-256 integrity anchor |
| `clawguard.registryAddr` | `0x2205AC...` | SkillRegistry contract |
| `clawguard.status` | `ACTIVE` \| `REVOKED` | Revocation status |
| `description` | Human-readable text | Discovery |
| `url` | Documentation link | Discovery |

---

## Deployed Contracts

| Contract | Network | Address |
|---|---|---|
| `SkillRegistry.sol` | 0G Galileo Testnet (16602) | [`0x2205AC38725F42d9da0ffaDD94166B5E5b83010A`](https://chainscan-galileo.0g.ai/address/0x2205AC38725F42d9da0ffaDD94166B5E5b83010A) |
| `clawhub.eth` | Sepolia (ENS) | [`0x2801Cd130F6dc93D89949476d70E2E6f033270EC`](https://app.ens.domains/clawhub.eth) |

**0G Storage:**
- Flow Contract: `0x22E03a6A89B950F1c82ec5e74F8eCa321a105296`
- Turbo Indexer: `https://indexer-storage-testnet-turbo.0g.ai`
- KV Discovery: Automatic (probes all storage nodes on port 6789)

**0G Compute:**
- Inference Contract: `0xa79F4c8311FF93C06b8CfB403690cc987c93F91E`
- Available models: `qwen/qwen-2.5-7b-instruct`, `qwen/qwen-image-edit-2511`

---

## Security Rules

| Rule | Description |
|---|---|
| **S-01** | Fail-closed by default — blocks all calls if manifest cannot be fetched |
| **S-02** | Violation events never include raw tool parameters (no key/secret leakage) |
| **S-03** | Manifest integrity verified via SHA-256 hash comparison at every fetch |
| **S-04** | KV node discovered dynamically — never relies on a single hardcoded endpoint |
| **S-05** | ENS subname revocation sets `REVOKED` status; middleware rejects revoked skills |

---

## Testing

```bash
# Unit tests (offline, no network)
npm run test --workspace=packages/core
# → 28/28 passed

# Integration tests (real 0G Galileo Testnet)
npx ts-node --project packages/core/tsconfig.json packages/core/integration.test.ts
# → 11/11 passed
```

**Integration test coverage:**
- ✅ T1: Chain connectivity (chainId 16602)
- ✅ T2: MemData upload to 0G Storage
- ✅ T3: Download + Merkle proof verification
- ✅ T4: KV Batcher write (manifest)
- ✅ T5: KV dynamic node discovery + read
- ✅ T6: Violation log upload (tamper-proof)
- ✅ T7: `registerSkill()` on SkillRegistry.sol
- ✅ T8: `getSkillRecord()` read-back
- ✅ T9: 0G Compute provider discovery (2 providers found)

---

## ENS CLI Reference

```bash
# Bootstrap (one-time): create skills.clawhub.eth
npx ts-node packages/contracts/src/ENSRegistrar.ts bootstrap

# Register a skill subname
npx ts-node packages/contracts/src/ENSRegistrar.ts register \
  --skill defi-reader \
  --manifest-hash 0xabc... \
  --description "Read-only DeFi agent"

# Resolve/inspect any skill's ENS record
npx ts-node packages/contracts/src/ENSRegistrar.ts resolve --skill defi-reader

# Revoke a skill (sets status=REVOKED on-chain)
npx ts-node packages/contracts/src/ENSRegistrar.ts revoke --skill rogue-skill
```

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `ZG_PRIVATE_KEY` | ✅ | Wallet private key (hex) |
| `ZG_CHAIN_RPC` | ✅ | 0G Galileo EVM RPC |
| `ZG_INDEXER_RPC` | ✅ | 0G Storage indexer (turbo) |
| `ZG_FLOW_CONTRACT` | ✅ | 0G Flow contract address |
| `REGISTRY_ADDRESS` | ✅ | Deployed SkillRegistry address |
| `ETH_SEPOLIA_RPC` | ✅ | Sepolia RPC for ENS |
| `ZG_KV_NODE_RPC` | ⬜ | KV node hint (auto-discovered if absent) |
| `ZG_STREAM_ID` | ⬜ | ClawGuard KV stream ID (has default) |

---

## License

MIT © ClawGuard Contributors
