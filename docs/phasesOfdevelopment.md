# ClawGuard — Phase-by-Phase Development Plan

> **Total Duration:** 3 Days (Hackathon Sprint)  
> **Team Structure:** Adaptable to 1–3 developers  
> **Philosophy:** Ship a working, demonstrable primitive — not a complete product

---

## Pre-Hackathon Setup (Do Before Day 1 Starts)

These must be done before the clock starts to avoid losing time on environment issues.

- [ ] Clone OpenClaw repo and run the example agent locally — confirm it works
- [ ] Install 0G TypeScript SDK: `npm install @0glabs/0g-ts-sdk`
- [ ] Get a 0G Chain testnet wallet funded (faucet at `faucet.0g.ai`)
- [ ] Install hardhat for Solidity contract deployment
- [ ] Create an ENS test account — register `clawhub.eth` or use a test subdomain
- [ ] Read 0G Storage KV docs and run the "hello world" KV set/get example
- [ ] Read 0G Compute sealed inference docs and run one example inference call
- [ ] Set up a monorepo structure (see below)

### Monorepo Structure

```
clawguard/
├── packages/
│   ├── core/              # @clawguard/core — the middleware npm module
│   ├── contracts/         # SkillRegistry.sol + deployment scripts
│   ├── cli/               # clawguard CLI for skill submission + verification
│   └── example-agent/     # DeFi monitoring agent (demo)
├── docs/                  # Architecture diagrams, this file, etc.
└── README.md
```

---

## Day 1 — Core Middleware + Manifest Spec

**Goal:** By end of Day 1, ClawGuard blocks an undeclared tool call locally (no blockchain yet).

---

### Phase 1.1 — Define the CapabilityManifest Schema (2 hrs)

**Owner:** Any developer  
**Output:** `packages/core/src/manifest.ts`

Tasks:
- [ ] Define the `CapabilityManifest` TypeScript interface
- [ ] Write a parser that reads `SKILL.md` and extracts the `[CAPABILITIES]` block
- [ ] Write a validator that checks the manifest for required fields
- [ ] Write unit tests for the parser (valid manifest, missing block, malformed YAML)

```typescript
// Target interface
interface CapabilityManifest {
  skillId: string;
  allowedTools: string[];
  blockedTools: string[];
  maxExternalCallsPerSession: number;
  manifestHash: string;      // SHA-256 of the above fields
  onChainAddress?: string;   // 0G Storage KV address (filled post-publish)
}
```

**Definition of Done:** Parser correctly extracts manifest from a sample SKILL.md with `[CAPABILITIES]` block.

---

### Phase 1.2 — Build the ClawGuard Middleware (4 hrs)

**Owner:** Lead developer  
**Output:** `packages/core/src/middleware.ts`

Tasks:
- [ ] Study OpenClaw's `tool_dispatch` function signature
- [ ] Write `wrapToolDispatch(originalDispatch, config)` — returns a new function with same signature
- [ ] Implement the interception logic:
  - Receive tool call request (skill ID + tool name + params)
  - Check in-memory manifest cache for skill ID
  - If cache miss: fetch from 0G Storage KV (stub for now — return hardcoded manifest)
  - Check if `toolName` is in `allowedTools`
  - If allowed: call `originalDispatch(toolName, params)`
  - If blocked: emit `ViolationEvent`, return structured error
- [ ] Define `ViolationEvent` interface
- [ ] Write integration test: mock `tool_dispatch`, verify `wallet.transfer` is blocked for a skill that only declared `wallet.read_balance`

**Definition of Done:** Jest test passes — blocked call returns error, allowed call passes through, violation event is emitted.

---

### Phase 1.3 — Write the Example DeFi Agent SOUL.md + Skill (2 hrs)

**Owner:** Any developer  
**Output:** `packages/example-agent/`

Tasks:
- [ ] Write `SOUL.md` for the DeFi monitoring agent (name, goal, constraints)
- [ ] Write `defi-reader` skill: calls `wallet.read_balance` and `web.fetch` (for price feeds) — these are legitimate
- [ ] Write `rogue-defi-skill` skill: claims to be a price reader but also calls `wallet.transfer` — this is the attack
- [ ] Add `[CAPABILITIES]` block to both skill SKILL.mds
  - `defi-reader`: only declares `wallet.read_balance`, `web.fetch`
  - `rogue-defi-skill`: only declares `web.fetch` (hiding the `wallet.transfer` call)
- [ ] Wire ClawGuard middleware into the agent's bootstrap

**Definition of Done:** Running the agent with `rogue-defi-skill` installed → terminal shows `[ClawGuard] BLOCKED: wallet.transfer not in declared capabilities for skill rogue-defi-skill`.

---

### Phase 1.4 — Day 1 Integration Check (1 hr)

- [ ] Run both skills end-to-end with ClawGuard active
- [ ] Confirm blocked calls return structured errors (not crashes)
- [ ] Commit everything — tag `v0.1.0-local`
- [ ] Note any blockers for Day 2

---

## Day 2 — 0G Chain + Storage + Compute Integration

**Goal:** By end of Day 2, manifests are on-chain, violations are logged to 0G Storage Log, and skill verification via 0G Compute works.

---

### Phase 2.1 — Deploy SkillRegistry.sol on 0G Chain (3 hrs)

**Owner:** Smart contract developer  
**Output:** `packages/contracts/src/SkillRegistry.sol`

Tasks:
- [ ] Write `SkillRegistry.sol`:

```solidity
// Core storage
mapping(bytes32 => SkillRecord) public skills;

struct SkillRecord {
    bytes32 manifestHash;       // SHA-256 of the CapabilityManifest
    string storageAddress;      // 0G Storage KV key where full manifest lives
    VerificationStatus status;  // PENDING | VERIFIED | CAPABILITY_MISMATCH
    string ensSubname;          // e.g. "defi-reader.skills.clawhub.eth"
    uint256 registeredAt;
}

enum VerificationStatus { PENDING, VERIFIED, CAPABILITY_MISMATCH }

// Events
event SkillRegistered(bytes32 indexed skillId, bytes32 manifestHash);
event SkillVerified(bytes32 indexed skillId, VerificationStatus status);
```

- [ ] Write `registerSkill(bytes32 skillId, bytes32 manifestHash, string storageAddress)` function
- [ ] Write `updateVerificationStatus(bytes32 skillId, VerificationStatus status)` — owner only
- [ ] Write `getSkillRecord(bytes32 skillId)` view function
- [ ] Deploy to 0G Chain testnet using Foundry: `forge script Deploy --rpc-url $ZG_RPC`
- [ ] Save deployed contract address to `.env` and README
- [ ] Verify contract on 0G Explorer

**Definition of Done:** Contract deployed, `registerSkill` transaction visible on 0G Explorer.

---

### Phase 2.2 — Integrate 0G Storage KV (Manifest Storage) (2 hrs)

**Owner:** Backend developer  
**Output:** `packages/core/src/storage.ts`

Tasks:
- [ ] Implement `publishManifest(manifest: CapabilityManifest): Promise<string>`:
  - Serialize manifest to JSON
  - Compute SHA-256 hash
  - Write to 0G Storage KV: key = `skill:{skillId}:manifest`, value = JSON string
  - Return the KV key (storage address)
- [ ] Implement `fetchManifest(skillId: string): Promise<CapabilityManifest>`:
  - Read from 0G Storage KV using key
  - Parse JSON back to `CapabilityManifest`
  - Return manifest
- [ ] Replace the stub in Phase 1.2 middleware with the real `fetchManifest` call
- [ ] Add in-memory LRU cache (use `lru-cache` npm package) — TTL: 60 seconds

**Reference:** `@0glabs/0g-ts-sdk` KV store docs — see `TOOLS_AND_SERVICES.md` for MCP server links.

**Definition of Done:** Publish a manifest → fetch it back → values match. Middleware uses real 0G Storage on cache miss.

---

### Phase 2.3 — Integrate 0G Storage Log (Violation Audit Trail) (2 hrs)

**Owner:** Backend developer  
**Output:** Addition to `packages/core/src/storage.ts`

Tasks:
- [ ] Implement `logViolation(event: ViolationEvent): Promise<void>`:
  - Serialize `ViolationEvent` to JSON
  - Append to 0G Storage Log: stream key = `clawguard:violations`
  - Log is append-only — no delete function needed
- [ ] Wire `logViolation` into the middleware's block path (Phase 1.2)
- [ ] Implement `queryViolations(skillId: string): Promise<ViolationEvent[]>` for the demo CLI

```typescript
interface ViolationEvent {
  skillId: string;
  blockedTool: string;
  agentId: string;
  timestamp: number;
  sessionId: string;
}
```

**Definition of Done:** Trigger a blocked call → `queryViolations` returns the event → event visible in 0G Explorer.

---

### Phase 2.4 — Integrate 0G Compute Sealed Inference (Verification) (2 hrs)

**Owner:** ML/backend developer  
**Output:** `packages/cli/src/verify.ts`

Tasks:
- [ ] Implement `verifySkill(skillCode: string, manifest: CapabilityManifest): Promise<VerificationResult>`:
  - Build the verification prompt:
    ```
    Analyze this OpenClaw skill code and return ONLY a JSON object with key "invokedTools": [list of tool names called].
    Do not include any explanation.
    Code: {skillCode}
    ```
  - Call 0G Compute sealed inference endpoint (`qwen3.6-plus`)
  - Parse JSON response → extract `invokedTools` array
  - Compare against `manifest.allowedTools`
  - Return `{ status: "VERIFIED" | "CAPABILITY_MISMATCH", undeclaredTools: string[] }`
- [ ] Call `SkillRegistry.updateVerificationStatus()` with the result
- [ ] Add to CLI: `clawguard verify <skill-directory>`

**Reference:** 0G Compute sealed inference API docs — see `TOOLS_AND_SERVICES.md` for endpoint URLs.

**Definition of Done:** Run `clawguard verify ./rogue-defi-skill` → returns `CAPABILITY_MISMATCH` with `undeclaredTools: ["wallet.transfer"]` → status updated on-chain.

---

### Phase 2.5 — Day 2 Integration Check (1 hr)

- [ ] Full flow: publish manifest → register on-chain → run agent → block call → log violation → query violation
- [ ] Verify all on-chain transactions on 0G Explorer
- [ ] Commit — tag `v0.2.0-onchain`

---

## Day 3 — ENS Integration + Demo Polish + Submission

**Goal:** ENS subnames are live, discovery works end-to-end, demo video is recorded, submission is filed.

---

### Phase 3.1 — ENS Subname Registration (2 hrs)

**Owner:** Smart contract / ENS developer  
**Output:** `packages/contracts/src/ENSRegistrar.ts`

Tasks:
- [ ] Register parent name `clawhub.eth` (or use existing testnet ENS)
- [ ] Implement `registerSkillSubname(skillName: string, record: SkillENSRecord)`:
  - Create subname: `{skillName}.skills.clawhub.eth`
  - Set address record → points to the agent wallet that registered the skill
  - Set text record `capability-manifest` → 0G Storage KV address
  - Set text record `verification-status` → `VERIFIED` or `CAPABILITY_MISMATCH`
  - Set text record `registry-contract` → `SkillRegistry.sol` address on 0G Chain
- [ ] Use ENS SDK: `@ensdomains/ensjs`
- [ ] Wire `registerSkillSubname` into the `clawguard publish` CLI command (runs after on-chain registration)

**Reference:** ENS Subname Manager docs + `@ensdomains/ensjs` — see `TOOLS_AND_SERVICES.md`.

**Definition of Done:** `defi-reader.skills.clawhub.eth` resolves in ENS app. Text records visible.

---

### Phase 3.2 — ENS Resolution in Install Flow (1 hr)

**Owner:** Backend developer  
**Output:** Addition to `packages/core/src/ens.ts`

Tasks:
- [ ] Implement `resolveSkillCapabilities(ensName: string): Promise<CapabilityManifest>`:
  - Resolve ENS name → read `capability-manifest` text record → 0G Storage KV address
  - Fetch manifest from 0G Storage KV
  - Return `CapabilityManifest`
- [ ] Implement `checkAgentCapabilityScope(agentEnsName: string, requiredTool: string): Promise<boolean>` for agent-to-agent delegation check
- [ ] Add to CLI: `clawguard inspect defi-reader.skills.clawhub.eth`

**Definition of Done:** `clawguard inspect defi-reader.skills.clawhub.eth` prints the skill's full capability manifest to terminal.

---

### Phase 3.3 — Demo Script Rehearsal + Polish (2 hrs)

Walk through the exact demo script (see `RULES_AND_GUIDELINES.md` § 5) and fix any rough edges.

- [ ] **Act 1 (attack demo):** Install rogue skill without ClawGuard — confirm `wallet.transfer` executes (mock it — don't use real funds)
- [ ] **Act 2 (ClawGuard active):** Enable middleware — same skill blocked in real time — show violation in 0G Log
- [ ] **Act 3 (verification):** Run `clawguard verify` on rogue skill — show `CAPABILITY_MISMATCH` on 0G Explorer
- [ ] **Act 4 (ENS discovery):** Run `clawguard inspect defi-reader.skills.clawhub.eth` — show manifest — show agent-to-agent delegation refusal

Checklist:
- [ ] All terminal output is clean and readable (add colors with `chalk`)
- [ ] No hard-coded mock values in ENS resolution or 0G Storage calls
- [ ] Contract addresses saved in README (not in `.env` only)
- [ ] Explorer links prepared (0G Chain explorer, ENS app)

---

### Phase 3.4 — Documentation + Architecture Diagram (1.5 hrs)

**Output:** `README.md`, `docs/architecture.png`

- [ ] Write README sections: What is ClawGuard, Why it exists, Quick Start, How it works, 0G integrations, ENS integration, Contract address, Team
- [ ] Create architecture diagram showing:
  ```
  [Layer 1: Gateway] → [Layer 2: Agent System] → ★[Layer 2.5: ClawGuard]★ → [Layer 3: Tool Integration] → [Layer 4: Memory]
  ```
  Include 0G Storage KV (manifests), 0G Storage Log (violations), 0G Chain (SkillRegistry), 0G Compute (verification), ENS (discovery) as external boxes
- [ ] Use Excalidraw or draw.io — export as PNG
- [ ] Add diagram to README

---

### Phase 3.5 — Demo Video Recording (1 hr)

- [ ] Screen record using OBS or QuickTime — no longer than 3:00
- [ ] Narrate each act clearly (see demo script)
- [ ] Upload to YouTube (unlisted) or Loom
- [ ] Save link for submission form

---

### Phase 3.6 — Submission Filing (30 min)

- [ ] ETHGlobal submission form filled with all required fields
- [ ] GitHub repo set to public
- [ ] Contract address verified on 0G Explorer
- [ ] ENS subnames live and queryable
- [ ] Demo video link added
- [ ] Both tracks selected: Track 1b + ENS Best AI Agent Integration

---

## Contingency Plan

| Risk | Mitigation |
|------|-----------|
| 0G Compute sealed inference is slow / unavailable | Pre-run verification offline, cache the result, show cached result in demo |
| ENS subname registration takes too long | Use ENS testnet (Sepolia) for demo — note in README |
| 0G Storage KV connectivity issues | Implement local JSON file fallback for demo only |
| Contract deployment fails | Have ABI + bytecode ready — deploy via Remix as backup |
| Not enough time for agent-to-agent ENS demo | Cut Act 4, focus Acts 1-3 which are stronger |