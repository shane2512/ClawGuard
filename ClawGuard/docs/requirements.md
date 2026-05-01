# ClawGuard — Requirements Specification

> **Version:** 1.0  
> **Hackathon:** ETHGlobal OpenAgents  
> **Tracks:** Track 1b (Best Agent Framework, Tooling & Core Extensions) + ENS (Best ENS Integration for AI Agents)  
> **Prize Pool Target:** $7,500 (Track 1b) + $2,500 (ENS) = $10,000

---

## 1. Project Overview

**ClawGuard** is a declarative capability enforcement framework for OpenClaw — an OAuth-style, on-chain enforced permission middleware that sits between OpenClaw's Agent System and Tool Integration layers. It prevents overprivileged skills from accessing tools they never declared, anchors all permission proofs on 0G Chain, and uses ENS subnames as the canonical discovery and verification layer for skill identities.

### 1.1 One-Line Problem Statement

OpenClaw agents share their full tool access with every installed skill — there is no sandbox, no scoping, and no on-chain verification — so a rogue skill can steal wallet credentials the moment it's installed.

### 1.2 One-Line Solution

ClawGuard intercepts every tool call from every skill at runtime, checks it against an immutable on-chain capability manifest, blocks undeclared tool access, and logs all violations to a tamper-proof audit trail on 0G Storage.

---

## 2. Functional Requirements

### 2.1 CapabilityManifest (FR-01 to FR-05)

| ID | Requirement |
|----|-------------|
| FR-01 | The system MUST define a `[CAPABILITIES]` block extension to OpenClaw's `SKILL.md` format |
| FR-02 | The manifest MUST support `allowed_tools`, `blocked_tools`, and `max_external_calls_per_session` fields |
| FR-03 | The manifest MUST be hashed (SHA-256) and the hash stored in 0G Storage KV |
| FR-04 | The manifest hash MUST be anchored to a `SkillRegistry` smart contract on 0G Chain |
| FR-05 | Once published, a skill's manifest hash MUST be immutable on-chain |

**Example manifest block:**

```yaml
[CAPABILITIES]
allowed_tools:
  - web.search
  - web.fetch
  - wallet.read_balance
blocked_tools:
  - wallet.transfer
  - wallet.approve
  - shell.exec
max_external_calls_per_session: 20
```

---

### 2.2 ClawGuard Middleware (FR-06 to FR-14)

| ID | Requirement |
|----|-------------|
| FR-06 | ClawGuard MUST be distributed as a standalone npm module (`@clawguard/core`) |
| FR-07 | The middleware MUST wrap OpenClaw's `tool_dispatch` function without modifying the OpenClaw source |
| FR-08 | On every tool call, the middleware MUST fetch the calling skill's CapabilityManifest from 0G Storage KV |
| FR-09 | Manifest responses MUST be cached in-memory after the first fetch per session |
| FR-10 | If the requested tool is in `allowed_tools` → the call MUST be forwarded to the original `tool_dispatch` |
| FR-11 | If the requested tool is NOT in `allowed_tools` → the call MUST be blocked and a `ViolationEvent` logged |
| FR-12 | `ViolationEvent` MUST be appended to 0G Storage Log (append-only, tamper-proof) |
| FR-13 | The middleware MUST expose a `ClawGuardConfig` interface for opt-in/opt-out at agent level |
| FR-14 | Blocking a call MUST NOT crash the agent — it MUST return a structured error to the skill |

---

### 2.3 Sealed Capability Verification (FR-15 to FR-20)

| ID | Requirement |
|----|-------------|
| FR-15 | When a skill is submitted, its source code MUST be sent to 0G Compute's sealed inference endpoint |
| FR-16 | The sealed inference MUST use `qwen3.6-plus` or `GLM-5-FP8` model |
| FR-17 | The inference prompt MUST extract a JSON capability fingerprint (list of all tools invoked in code) |
| FR-18 | The extracted fingerprint MUST be compared against the skill's declared `[CAPABILITIES]` block |
| FR-19 | If fingerprint matches declared capabilities → skill receives `VERIFIED` status on 0G Chain |
| FR-20 | If fingerprint contains undeclared tool calls → skill receives `CAPABILITY_MISMATCH` status on 0G Chain |

---

### 2.4 ENS Integration (FR-21 to FR-27)

| ID | Requirement |
|----|-------------|
| FR-21 | Each verified skill MUST be issued an ENS subname under the pattern: `<skill-name>.skills.clawhub.eth` |
| FR-22 | The ENS subname MUST carry a `capability-manifest` text record pointing to the skill's 0G Storage address |
| FR-23 | The ENS subname MUST carry a `verification-status` text record (`VERIFIED` or `CAPABILITY_MISMATCH`) |
| FR-24 | Before install, an agent or user MUST be able to resolve the skill's ENS name to read its on-chain capability scope |
| FR-25 | The `SkillRegistry` contract MUST write ENS text records programmatically on skill registration |
| FR-26 | Agent-to-agent capability discovery MUST work via ENS resolution: Agent A resolves Agent B's `.eth` name to check capability scope before delegating |
| FR-27 | ENS resolution MUST be functional and not hard-coded in the demo |

---

### 2.5 Example Demo Agent (FR-28 to FR-30)

| ID | Requirement |
|----|-------------|
| FR-28 | A DeFi monitoring agent MUST be provided as the working example (reads wallet balance, price feeds) |
| FR-29 | The agent MUST demonstrate a live blocked `wallet.transfer` call in the demo |
| FR-30 | The violation MUST be visible on-chain (0G Storage Log, queryable on 0G Explorer) |

---

## 3. Non-Functional Requirements

| ID | Category | Requirement |
|----|----------|-------------|
| NFR-01 | Performance | Manifest cache lookup MUST complete in < 5ms (in-memory cache hit) |
| NFR-02 | Performance | 0G Storage KV fetch (cache miss) MUST complete in < 500ms |
| NFR-03 | Security | ClawGuard MUST NOT be bypassable by a skill calling `tool_dispatch` directly (wrapper must replace the reference) |
| NFR-04 | Security | The `SkillRegistry` contract MUST be non-upgradeable or use a transparent proxy with time-lock |
| NFR-05 | Reliability | A failure to fetch the manifest (network error) MUST default to DENY (fail-closed) |
| NFR-06 | Compatibility | ClawGuard MUST work with any OpenClaw-compatible agent without modifying the agent's SOUL.md |
| NFR-07 | Auditability | Every violation event MUST be permanently queryable from 0G Storage Log |
| NFR-08 | Developer UX | Integration MUST require no more than 3 lines of code change in an existing OpenClaw agent |

---

## 4. Hackathon Qualification Checklist

### Track 1b — Framework Checklist

- [ ] Project name + short description in submission
- [ ] Contract deployment address for `SkillRegistry.sol` on 0G Chain
- [ ] Public GitHub repo with README and setup instructions
- [ ] Demo video under 3 minutes
- [ ] Live demo link
- [ ] Explanation of which 0G protocol features/SDKs used (Storage KV, Storage Log, Compute, Chain)
- [ ] At least one working example agent (DeFi monitoring agent)
- [ ] Architecture diagram showing Layer 2.5 placement in OpenClaw stack
- [ ] Team member names, Telegram, and X handles

### ENS Track — Checklist

- [ ] ENS is doing real work (resolving capability manifests, gating installs, enabling discovery)
- [ ] Not cosmetic — ENS resolution is required for skill install flow to function
- [ ] Functional demo with no hard-coded values
- [ ] Video or live demo link

---

## 5. Out of Scope (for Hackathon MVP)

- Skill reputation scoring or community reviews
- Agent payment flows or agent-to-agent hiring
- Full production-grade rate limiting on the middleware
- Support for agent frameworks other than OpenClaw
- UI dashboard (CLI demo is sufficient)