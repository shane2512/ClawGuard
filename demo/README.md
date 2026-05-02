# ClawGuard Demo — Recording Guide

> Self-contained demo folder for hackathon video recording.
> All scenes use the parent project .env automatically.

---

## Section 1: Setup (do this ONCE before recording)

```bash
# 1. Navigate to the demo folder
cd demo

# 2. Install dependencies (uses published @shanejoans/clawguard from npm)
npm install

# 3. Verify .env is loaded correctly (uses parent project .env)
cat ../.env | grep ZG_
```

The demo reads credentials from `d:/Project/ClawGuard/.env` automatically.
You do NOT need to create a local `.env` in the demo folder unless running standalone.

---

## Section 2: Pre-Flight (run before EVERY recording session)

```bash
npm run preflight
```

All 6 checks must show [PASS] before you start recording:

| Check | What it verifies |
|---|---|
| 0G Chain RPC | Galileo testnet reachable, chainId=16602 |
| 0G Storage Indexer | Indexer REST API responding |
| Wallet Balance | Signing wallet has >= 0.01 OG |
| ENS Resolution | defi-reader.skills.clawhub.eth resolves to a storage key |
| SkillRegistry | Contract is deployed and callable |
| Skill files | SKILL.md files exist locally in demo/skills/ |

---

## Section 3: Individual Demo Commands

Run these in order during the recording. Each is independent.

### STEP 0 — Show the repo (optional context)
```bash
ls ../packages/core/src/
```
*Say: "ClawGuard is an SDK. This is the core middleware package."*

---

### STEP 1 — Preflight
```bash
npm run preflight
```
*Say: "Before we start — confirming all services are live."*
Expected: 6 green [PASS] lines, "All systems ready."
Duration: ~15 seconds

---

### STEP 2 — Scene 1: The Problem (no guard)
```bash
npm run demo:problem
```
*Say: "First — what happens without ClawGuard. A rogue skill calls wallet.transfer. Nothing stops it."*

Expected output:
```
[tool]  web.fetch -> { price: '$1,883.06', asset: 'ETH' }
[tool]  wallet.read_balance -> balance: 4.2000 ETH
[NO GUARD] wallet.transfer EXECUTED -- funds at risk.
[NO GUARD] Tx: 0xFAKE_STOLEN_TX_deadbeef...
This is ClawGuard's reason for existing.
```
Duration: ~3 seconds

---

### STEP 3 — Scene 2: The Manifest
```bash
npm run demo:manifest
```
*Say: "Every skill declares its capabilities in a SKILL.md file. ClawGuard parses this. defi-reader says: read-only only. The rogue skill says the same — but its actual code calls wallet.transfer."*

Expected output: color-coded SKILL.md, side-by-side declared vs actual table.
Duration: ~4 seconds

---

### STEP 4 — Scene 3: ENS Resolution
```bash
npm run demo:ens
```
*Say: "ENS is the discovery layer. Agents resolve a skill name to get its storage key, then fetch the manifest from 0G Storage and verify the hash."*

Expected output:
```
[1] Resolving ENS: defi-reader.skills.clawhub.eth ...
    OK  ENS text records resolved.
        Storage Key : 0xdd242aed...
[2] Fetching manifest from 0G File Storage...
    OK  Manifest downloaded from 0G Storage.
        0G StorageScan: https://storagescan-galileo.0g.ai/tx/0xdd242...
[3] Parsing capability manifest...
    OK  Manifest parsed successfully.
        Allowed Tools : web.fetch, wallet.read_balance
[4] Verifying manifest integrity (SHA-256 hash check)...
    OK  Hash verified -- manifest has NOT been tampered with.
```
Duration: ~10 seconds

---

### STEP 5 — Scene 4: THE MONEY MOMENT (middleware blocking)
```bash
npm run demo:block
```
*Say: "This is ClawGuard's core value. Three lines of code wrap the agent's tool dispatch. The rogue skill calls wallet.read_balance — allowed. Then wallet.transfer — blocked. The violation is automatically uploaded to 0G Storage Log."*

Expected output:
```
[ClawGuard] ALLOWED -- wallet.read_balance
[tool]      Result: balance=4.2000 ETH

[ClawGuard] BLOCKED -- wallet.transfer
[ClawGuard] Reason : NOT_IN_ALLOWED_TOOLS
Funds are safe. Attack prevented.

[0G Audit] Violation uploaded to 0G Storage Log
[0G Audit]    Root hash: 0x<hash>
[0G Audit]    View     : https://storagescan-galileo.0g.ai/tx/<hash>
```
Duration: ~15 seconds (includes 0G upload)

---

### STEP 6 — Scene 5: On-Chain Badge (0G Compute + SkillRegistry)
```bash
npm run demo:verify
```
*Say: "Finally — 0G Compute runs sealed inference on the rogue skill's code. It finds wallet.transfer. That is a CAPABILITY_MISMATCH. The badge is anchored on 0G Chain via SkillRegistry.sol."*

Expected output:
```
>> Sending to 0G Compute sealed inference...
     Provider : 0x...
     Model    : qwen/qwen-2.5-7b-instruct

>> Comparing fingerprint against declared capabilities...
     Declared   : web.fetch, wallet.read_balance
     Detected   : web.fetch, wallet.read_balance, wallet.transfer
     Undeclared : wallet.transfer
     Result: CAPABILITY_MISMATCH

>> Anchoring verification badge on 0G Chain...
     Badge anchored on 0G Chain: CAPABILITY_MISMATCH
     Tx hash  : 0x<hash>
     Explorer : https://chainscan-galileo.0g.ai/tx/<hash>
```
Duration: ~30-60 seconds (inference is slow — warn judges in voiceover)

---

## Section 4: Full Run (one command, all 5 scenes)

```bash
npm run demo:full
```

Runs all scenes back-to-back with separators. Use this if you want a single continuous recording.

---

## Section 5: What Each Output Proves (for judges)

| Scene | Output | What it proves |
|---|---|---|
| 1 — Problem | wallet.transfer executes unblocked | Why ClawGuard exists |
| 2 — Manifest | SKILL.md printed, declared vs actual | How capability declaration works |
| 3 — ENS | ENS -> 0G hash -> manifest -> hash verified | ENS does REAL functional work (not cosmetic) |
| 4 — Block | Violation blocked + 0G Storage Log tx hash | Core enforcement + 0G Log audit trail |
| 5 — Verify | CAPABILITY_MISMATCH + 0G Chain tx hash | 0G Compute + SkillRegistry on-chain badge |

### Key URLs to show during recording:
- ENS: https://app.ens.domains/defi-reader.skills.clawhub.eth
- StorageScan (manifest): https://storagescan-galileo.0g.ai/tx/0xdd242aedb2f82ee89fb4c2944781930c1a6b5d67869016d4c498a694a7af85f0
- SkillRegistry: https://chainscan-galileo.0g.ai/address/0x2205AC38725F42d9da0ffaDD94166B5E5b83010A
- npm SDK: https://www.npmjs.com/package/@shanejoans/clawguard

---

## Quick Reference — All Commands

```bash
npm install          # one-time setup
npm run preflight    # run before EVERY recording
npm run demo:problem # scene 1 — the attack
npm run demo:manifest # scene 2 — manifest format
npm run demo:ens     # scene 3 — ENS resolution
npm run demo:block   # scene 4 — BLOCKING (main demo)
npm run demo:verify  # scene 5 — compute + on-chain badge
npm run demo:full    # all scenes in one command
```
