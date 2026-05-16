# Spectra: OpenClaw Agent Demo

This directory contains the **Spectra Agent** demo suite — a fully functional OpenClaw AI agent showcasing **ClawGuard** capability enforcement middleware powered by the 0G ecosystem.

## What is Spectra?

Spectra is a DeFi Market Intelligence Agent built on the OpenClaw framework. It demonstrates how ClawGuard enforces zero-trust security boundaries on autonomous agents using 0G infrastructure.

### Key Features

- **Declarative Security:** Loads rules from `SOUL.md`, `AGENTS.md`, and capability limits from `SKILL.md`.
- **Zero-Trust Tool Dispatch:** Every tool call is intercepted by ClawGuard to ensure the agent stays within its authorized capabilities.
- **Tamper-Proof Audit Trails (0G Storage):** If Spectra (or an installed skill) attempts a blocked action like `wallet.transfer`, ClawGuard halts it mid-flight and uploads an immutable `ViolationEvent` to **0G Storage**.
- **On-Chain Registry (0G Chain):** Manifest integrity hashes are anchored on `SkillRegistry.sol` deployed on 0G Galileo Testnet.
- **Sealed Verification (0G Compute):** Uses Qwen models via 0G Compute to verify agent code matches its declared capabilities.
- **ENS Discovery:** Resolves security manifests dynamically from ENS Subnames (`defi-reader.skills.clawhub.eth`).

## Running the Demo

### 1. Setup

```bash
cd demo
npm install
cp .env.example .env
```

Fill in your `.env` with the correct 0G and ENS variables. See the root `.env.example` for default values.

**Get testnet tokens:**
- **0G Galileo (OG):** https://faucet.0g.ai
- **Sepolia (ETH):** https://sepoliafaucet.com

### 2. Run the Full Spectra Agent

Run the complete end-to-end agent loop (demonstrates both legitimate and rogue skills):

```bash
npm run spectra
```

**What happens:**
1. Spectra boots up with its OpenClaw `SOUL.md` and `AGENTS.md`
2. Installs the `defi-reader` skill (legitimate — read-only DeFi data)
3. Installs the `rogue-defi-skill` (malicious — tries to call `wallet.transfer`)
4. ClawGuard intercepts the unauthorized call and **blocks it**
5. The violation is uploaded to **0G Storage** as an immutable audit record
6. The manifest hash is verified against the **0G Chain** SkillRegistry

### 3. Isolated Scenes

Run specific scenes to see individual pieces of the pipeline:

| Command | What It Does | 0G Component |
|---|---|---|
| `npm run demo:manifest` | Parses the local `SKILL.md` capability manifests | — |
| `npm run demo:ens` | Resolves the 0G storage key from ENS Text Records | 0G Storage |
| `npm run demo:block` | Simulates a live tool interception, blocks `wallet.transfer`, logs to 0G | 0G Storage |
| `npm run demo:verify` | Sends skill code to 0G Compute for sealed verification, anchors badge on-chain | 0G Compute + 0G Chain |

### 4. Variant Runs

```bash
# Run with only the legitimate skill (no violations)
npm run spectra:legit

# Run with the rogue skill (triggers ClawGuard blocking + 0G audit upload)
npm run spectra:rogue
```

---

## 0G Integration in the Demo

| 0G Component | Usage in Demo |
|---|---|
| **0G Storage** | Manifest hosting + violation audit log uploads |
| **0G Chain** | SkillRegistry.sol manifest hash anchoring |
| **0G Compute** | Sealed Qwen inference for capability verification |

---

## Reviewer Notes

- The demo runs in a local terminal and produces colorized output showing each step
- All 0G interactions are live — they hit the Galileo testnet in real-time
- If the 0G faucet is down, you can still run `npm run demo:manifest` which works offline
- The demo video showcases the full `npm run spectra` flow
