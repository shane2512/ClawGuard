# ClawGuard — Rules & Development Guidelines

> This is the team's law document. Every decision — architectural, implementation, or demo — must pass these rules.  
> When in doubt, refer here before writing code.

---

## 1. The Prime Directive

**ClawGuard is a framework primitive, not an agent.** Every feature, every line of code, must serve one of three outcomes:

1. **Block** — prevent an undeclared tool call from executing
2. **Prove** — anchor that block (or the capability declaration) on-chain with an immutable record
3. **Discover** — let any agent or user inspect a skill's declared scope before trusting it

If a proposed feature does not serve at least one of these three outcomes, it does not belong in the hackathon scope.

---

## 2. Architectural Rules

### Rule A-01: Never Modify OpenClaw Source
ClawGuard MUST be a wrapper, never a fork. The integration point is exclusively `wrapWithClawGuard(agent.tool_dispatch, config)`. If you find yourself editing OpenClaw's files, stop and find the wrapper approach instead.

### Rule A-02: Fail-Closed by Default
If ClawGuard cannot fetch a skill's manifest (network error, 0G Storage unavailable, any exception), it MUST block the tool call — not allow it. `failOpen: false` is the default. The `failOpen: true` option exists but must be explicitly set by the developer integrating ClawGuard.

### Rule A-03: Manifest is the Source of Truth
The on-chain hash anchored to `SkillRegistry.sol` is authoritative. If a manifest fetched from 0G Storage KV does not match the on-chain hash, ClawGuard MUST treat the skill as unverified and block all tool calls until the mismatch is resolved.

### Rule A-04: No Intelligence in the Middleware
The middleware does NOT use AI to decide whether a tool call is safe. It only does list membership checks (`allowedTools.includes(requestedTool)`). Intelligence belongs in the 0G Compute verification step — a separate, one-time process at skill submission. Runtime blocking is deterministic and fast.

### Rule A-05: Layer 2.5 is Stateless Per Call
The middleware holds one piece of state: the in-memory manifest cache. It has no knowledge of prior calls in the session beyond the `max_external_calls_per_session` counter (which is per-skill, per-session, reset on session end). No persistent state lives in the middleware — all persistence is in 0G Storage.

### Rule A-06: One npm Module, Zero Config Minimum
A developer who adds ClawGuard to their agent must be able to get protection with three lines of code. The advanced config (custom registry address, custom storage endpoint, custom model) is optional. The defaults must work on 0G testnet out of the box.

---

## 3. Security Rules

### Rule S-01: Treat Every Skill as Untrusted Until Verified
At runtime, a skill's `VERIFIED` badge on 0G Chain does not mean it is safe — it means its declared capabilities matched its analyzed code at the time of submission. ClawGuard still enforces the declared manifest at runtime. Verification is a signal, not a pass.

### Rule S-02: Do Not Log Sensitive Data to 0G Storage Log
The `ViolationEvent` logged to 0G Storage Log MUST NOT include: wallet addresses, private key fragments, user data, or the full parameters of the attempted tool call. Log only: `skillId`, `blockedTool`, `agentId`, `timestamp`, `sessionId`.

### Rule S-03: Manifest Hash Must Be Verified Before Trust
When fetching a manifest from 0G Storage KV, always recompute the SHA-256 hash of the retrieved JSON and compare it against the on-chain hash from `SkillRegistry.getSkillRecord()`. If they differ, block all calls and log a `MANIFEST_TAMPERED` event.

### Rule S-04: No Real Funds in the Demo
The demo agent operates in simulation mode. `wallet.transfer` is a mock function. If a real wallet is needed for demo purposes (e.g., showing `wallet.read_balance`), use a dedicated demo wallet with a trivially small balance, publicly documented in the README.

### Rule S-05: Private Keys in Environment Variables Only
No private keys in source code, no private keys in Git history. Use `.env` files with `.gitignore`. For the demo, use a throwaway funded testnet wallet.

---

## 4. 0G Integration Rules

### Rule Z-01: Read MCP Server Docs Before Every Integration
Before writing any code that touches 0G Storage KV, 0G Storage Log, 0G Chain, or 0G Compute:
1. Open the 0G MCP server
2. Query the specific API you're about to use
3. Read the response
4. Only then write implementation code

This is not optional. The 0G SDK API may differ from what you remember or assume.

> **How to query:** `npx @0glabs/0g-mcp` then ask: "Show me the TypeScript code to set a value in 0G KV store"

### Rule Z-02: Use All Four 0G Components
The submission requires demonstrating all four components. Do not skip any:

| Component | Used For | Required |
|-----------|----------|----------|
| 0G Storage KV | Manifest storage | ✅ Yes |
| 0G Storage Log | Violation audit trail | ✅ Yes |
| 0G Chain | SkillRegistry contract | ✅ Yes |
| 0G Compute | Sealed inference verification | ✅ Yes |

### Rule Z-03: Verify Every On-Chain Transaction in Explorer
After every contract deployment or state-changing transaction, copy the transaction hash and verify it on https://explorer.0g.ai. Keep a log of all transaction hashes in `docs/transactions.md` for the submission.

### Rule Z-04: Handle 0G SDK Errors Gracefully
Wrap all 0G SDK calls in try/catch. Never let a 0G error propagate uncaught to the agent runtime. On error, ClawGuard logs the error locally and applies Rule A-02 (fail-closed).

---

## 5. ENS Rules

### Rule E-01: ENS Must Do Real Work
At no point should ENS be used only for display. The skill install flow MUST resolve the ENS name to get the `capability-manifest` text record. If ENS resolution fails, the install MUST be blocked (fail-closed, same as manifest fetch).

### Rule E-02: Text Records Are Canonical
The ENS `capability-manifest` text record is the entry point for any external consumer of ClawGuard. It MUST always point to a valid 0G Storage KV address. Update it if the manifest is re-published.

### Rule E-03: No Hard-Coded ENS Values in Demo
The demo must resolve ENS names dynamically. Do not pre-load the manifest JSON in the demo code. The ENS → 0G Storage → manifest chain must execute live during the demo.

### Rule E-04: Subname Convention is Strict
All skill subnames MUST follow the pattern: `{skill-slug}.skills.clawhub.eth`
- Slug must be lowercase, hyphen-separated, no underscores
- Valid: `defi-reader.skills.clawhub.eth`
- Invalid: `DeFi_Reader.skills.clawhub.eth`

---

## 6. Demo Rules

### Rule D-01: Follow the Four-Act Structure
The demo video MUST follow this structure. Do not improvise the order.

**Act 1 — The Attack (30s)**
> Goal: Make the judges feel the pain before showing the solution.
- Show OpenClaw agent with wallet access, no ClawGuard
- Install `rogue-defi-skill`
- Show it calling `wallet.transfer` (mocked) — "funds gone"

**Act 2 — ClawGuard Active (60s)**
> Goal: Show the core primitive working.
- Enable ClawGuard (show the 3-line code change)
- Same rogue skill, same attack → blocked in real time
- Terminal: `[ClawGuard] BLOCKED: wallet.transfer not in declared capabilities`
- Open 0G Explorer → show the `ViolationEvent` in the Log

**Act 3 — Verification (60s)**
> Goal: Show the proactive defense layer.
- Run `clawguard verify ./rogue-defi-skill`
- Show 0G Compute sealed inference running
- Show output: `CAPABILITY_MISMATCH — undeclared tools: [wallet.transfer]`
- Show status updated on 0G Chain Explorer

**Act 4 — ENS Discovery (30s)**
> Goal: Show ENS doing real work.
- Run `clawguard inspect defi-reader.skills.clawhub.eth`
- Show ENS resolution → `capability-manifest` text record → 0G Storage → manifest JSON
- Show agent-to-agent delegation refusal based on capability scope

### Rule D-02: Video is Exactly Under 3 Minutes
Exceeding 3 minutes risks disqualification. Rehearse at least twice. Cut Act 4 before cutting any other act if time is tight.

### Rule D-03: Terminal Output Must Be Clean
No stack traces, no debug logs, no `undefined` values visible in the demo. Run with `NODE_ENV=demo` that suppresses verbose logging and shows only the clean ClawGuard output.

### Rule D-04: Show Real On-Chain State
The 0G Explorer URL with the violation event and the ENS app showing the text record must both be visible in the demo. Do not show screenshots — show live URLs.

---

## 7. Code Quality Rules

### Rule C-01: TypeScript Everywhere
All packages use TypeScript with strict mode enabled. No `any` types except in 0G SDK interop layers where types are not exported.

### Rule C-02: Every Public Function Has a JSDoc Comment
Minimum: one-line description, `@param` for each parameter, `@returns` describing the return value. This is required for the README auto-generation.

### Rule C-03: Tests for All Core Logic
The following must have unit tests before Day 2 begins:
- Manifest parser (valid, invalid, missing block)
- Tool dispatch interception (allowed call, blocked call, cache hit, cache miss)
- Manifest hash verification (match, mismatch)

### Rule C-04: Git Commit Convention
All commits must follow: `type(scope): message`
- `feat(core): add manifest hash verification`
- `fix(storage): handle KV fetch timeout`
- `chore(contracts): deploy SkillRegistry to 0G testnet`

Tag the end of each day: `v0.1.0-local`, `v0.2.0-onchain`, `v1.0.0-submission`

---

## 8. Submission Checklist (Final Gate)

Run through this before hitting Submit on ETHGlobal.

### Track 1b Checklist
- [ ] Project name + description written
- [ ] `SkillRegistry.sol` deployed — address recorded in README
- [ ] GitHub repo is public
- [ ] README has: What it is, How to set up, How to run, Which 0G features used, Architecture diagram
- [ ] At least one working example agent (`example-agent/` in repo)
- [ ] Demo video under 3:00 — uploaded to YouTube or Loom
- [ ] Live demo link (can be a Gitpod or Railway deployment of the CLI demo)
- [ ] All 4 0G components documented in README with specific SDK functions used
- [ ] Team member names, Telegram handles, X handles

### ENS Checklist
- [ ] ENS doing real work — documented in README with specific resolution flow
- [ ] No hard-coded manifest values in demo code
- [ ] Functional video or live demo link (same as Track 1b video is fine)
- [ ] ENS subname live on mainnet or Sepolia — show in demo

### Transaction Log (`docs/transactions.md`)
- [ ] `SkillRegistry.sol` deployment tx hash
- [ ] At least one `registerSkill` tx hash
- [ ] At least one `updateVerificationStatus` tx hash (VERIFIED)
- [ ] At least one `updateVerificationStatus` tx hash (CAPABILITY_MISMATCH)
- [ ] At least one 0G Storage Log append tx (violation event)

---

## 9. What ClawGuard Is NOT

To avoid scope creep, these are explicitly out of scope:

| Not In Scope | Why |
|---|---|
| Skill reputation/review system | Community scoring — different primitive |
| Agent-pays-agent | Payment layer — Track 1a territory |
| Freelancing / task marketplace | Common idea, wrong track |
| On-chain skill store UI | Frontend — not a framework primitive |
| Multi-chain support | 0G only for hackathon |
| Upgrading skills in-place | Governance — post-hackathon |
| Intelligence improvements to the agent | Track 1a territory |

If a team member proposes any of the above during the sprint, cite this table and redirect to the current task list.