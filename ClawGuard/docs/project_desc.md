Master Hackathon Idea: "ClawGuard"
A Declarative Capability Enforcement Framework for OpenClaw — the missing permission primitive for web3 agent security

🔴 The Problem (Documented, Real, Urgent)
Here's what makes this bulletproof as a problem statement — it's not hypothetical:
Installing a skill from ClawHub grants it access to the same resources as OpenClaw itself. There is no sandbox isolation between skills by default. There is no provenance verification before a skill executes. DEV Community
The deeper issue is that patching the RCE vulnerability doesn't address the governance gaps — overprivileged agents remain overprivileged. Nothing in the CVE patch revised the permissions model. DEV Community
Microsoft's own security blog diagnosed it precisely: the runtime can ingest untrusted text, download and execute skills from external sources, and perform actions with the credentials assigned to it — without equivalent controls on identity, input handling, or privilege scoping. CVE Find
And the ClawHavoc attack explicitly went after crypto: one skill posed as a cryptocurrency trading tool and silently stole wallet credentials from the agent's environment. Nebius
The root cause: at the time of the ClawHavoc campaign, the only requirement to publish a skill on ClawHub was a GitHub account at least one week old. There was no automated static analysis, no code review, no signing requirement. Conscia
This is the exact gap nobody has built a framework solution for. Docker sandboxing patches the OS layer. ClawGuard solves the permissions layer — which is completely untouched.

💡 The Idea: ClawGuard
One-liner: OAuth-style, on-chain enforced capability scoping for OpenClaw skills — so when your agent has wallet access, a rogue skill can't touch it.
Why it's original: It's not about agent intelligence, reputation, or payments. It's a pure infrastructure primitive — a new architectural layer that sits between OpenClaw's Agent System and Tool Integration layers, enforcing declared permissions at runtime and anchoring proofs on 0G.

🏗️ Architecture: Three Interlocking Primitives
Primitive 1: CapabilityManifest (0G Storage KV)
Extend OpenClaw's SKILL.md format with a new [CAPABILITIES] block:
yaml[CAPABILITIES]
allowed_tools:
  - web.search
  - web.fetch
  - wallet.read_balance     # read-only
blocked_tools:
  - wallet.transfer
  - wallet.approve
  - shell.exec
max_external_calls_per_session: 20
This manifest is hashed and stored in 0G Storage KV (fast read, agent can check it at runtime). The hash is anchored to a 0G Chain smart contract — the SkillRegistry. Once published, a skill's declared capabilities are immutable and on-chain verifiable.

Primitive 2: ClawGuard Middleware (New OpenClaw Layer 2.5)
This is the core framework contribution. It's an npm module that wraps OpenClaw's existing tool_dispatch function:
[Layer 1: Gateway] → [Layer 2: Agent System] → ★ [Layer 2.5: ClawGuard] ★ → [Layer 3: Tool Integration] → [Layer 4: Memory]
When any skill tries to call a tool:

ClawGuard intercepts the call
Fetches the skill's CapabilityManifest from 0G Storage KV (cached locally after first fetch)
Checks if the requested tool is in allowed_tools
If yes → executes normally
If no → blocks the call + appends a violation event to 0G Storage Log (append-only, tamper-proof audit trail)

This means even if a skill is a perfect social engineering job (professional docs, clean name), it structurally cannot call wallet.transfer if it never declared that capability.

Primitive 3: Sealed Capability Verification (0G Compute)
When a new skill is submitted to your framework's registry:

Skill code is sent to 0G Compute's sealed inference (qwen3.6-plus or GLM-5-FP8)
A structured prompt analyzes: "What tools does this code actually invoke? Return a JSON capability fingerprint."
The AI's output capability fingerprint is compared against the declared [CAPABILITIES] block
If they match → skill gets a VERIFIED badge on 0G Chain
If mismatch → flagged as CAPABILITY_MISMATCH — the skill claims innocence but code says otherwise

This is semantic verification running in a TEE (Trusted Execution Environment) — the verification itself is cryptographically tamper-proof, which no centralized scanner can claim.

🌐 ENS Integration (Claim Both Prizes)
This is how you go for Track 1b AND the ENS $2,500 prize simultaneously:

Skill Identity via ENS Subnames: Each verified skill gets published as an ENS subname: defi-reader.skills.clawhub.eth
ENS text record capability-manifest → points to the skill's 0G Storage address
Agent discovery before install: Before any user installs a skill, they (or their agent) resolve defi-reader.skills.clawhub.eth → get the on-chain capability declaration → see what it's allowed to do
Multi-agent coordination: Agent A can resolve agent-b.yourdomain.eth to discover Agent B's capability scope before delegating a task — "can this agent handle wallet ops or just reads?"

This makes ENS the discovery and verification layer for the skill ecosystem — not cosmetic. It does real work: resolving the capability contract address, gating access based on declared scope, enabling agent-to-agent capability discovery.

✅ How It Meets Every Qualification Requirement
Track 1b:
RequirementHow ClawGuard Meets ItFramework-level workIt's a new middleware layer — other builders plug it in, it's not tied to one agent use caseInspired by OpenClawDirect extension of OpenClaw's 4-layer architecture0G Storage integrationKV for live manifests, Log for immutable violation audit trail0G Compute integrationSealed inference for capability fingerprint verification0G Chain integrationSkillRegistry smart contract, anchors manifests + verification badgesWorking example agentDeFi monitoring agent with read-only wallet scope demonstrating blocked wallet.transfer callArchitecture diagramNew Layer 2.5 clearly placed in OpenClaw's existing layered diagramContract deploymentSkillRegistry.sol on 0G Chain
ENS Track:
RequirementHow ClawGuard Meets ItENS doing real workResolves skill capability manifests, gates install decisions, enables agent-to-agent discoveryNot cosmeticWithout ENS resolution, you can't discover or verify a skill's on-chain capability declarationFunctional demoShow ENS subname resolution → 0G Storage → capability manifest → blocked tool call

🎬 Demo Script (Under 3 Minutes)
Act 1 (30s): Show a bare OpenClaw agent with wallet access. Install a "DeFi price reader" skill from ClawHub. Without ClawGuard, that skill quietly calls wallet.transfer. Funds gone.
Act 2 (60s): Enable ClawGuard. Same skill is now associated with its ENS name defi-reader.skills.eth. Resolve it — see its on-chain declared capabilities: wallet.read_balance only. When the skill tries wallet.transfer → blocked in real time. Violation logged to 0G Storage Log. Show the log on explorer.
Act 3 (60s): Submit a new skill. 0G Compute sealed inference analyzes it, fingerprints its actual tool calls, compares against declared capabilities. Show VERIFIED vs CAPABILITY_MISMATCH badge on 0G Chain.
Act 4 (30s): Show a second agent resolving another agent's ENS name to check its capability scope before delegating a task. "Can you handle wallet transfers?" → resolve ENS → no wallet.transfer in scope → delegation refused automatically.

⏱️ 3-Day Build Plan
Day 1: Write the CapabilityManifest spec + build the ClawGuard middleware npm module. Integrate with OpenClaw's tool_dispatch. Test blocking locally. Write the example DeFi agent SOUL.md + skill.
Day 2: Deploy SkillRegistry.sol on 0G Chain. Integrate 0G Storage KV (manifest storage) + Log (violation events) using 0G TypeScript SDK. Build the 0G Compute sealed inference call for skill fingerprinting.
Day 3: ENS subname registration + text record integration. Wire ENS resolution into the skill install flow. Record demo video. Write README + architecture diagram. Deploy live demo.

🏆 Why This Wins
It solves a documented, public, ongoing crisis — the ClawHavoc attack is not hypothetical, it's in Microsoft's security blog and Trend Micro's threat reports. The judges will immediately recognize the problem.
It's genuinely framework-level — any OpenClaw agent in the world gets safer by adopting one npm module. That's the definition of infrastructure primitive that the track rewards.
It uses 0G's full stack (KV + Log + Chain + Compute) in ways each component is specifically designed for — not forced integrations. And ENS integration is functional and first-of-its-kind as a skill capability discovery layer.
Most importantly: it's none of the common ideas — no freelancing, no reputation scoring, no agent-pays-agent, no intelligence improvement. It's a pure execution-layer safety primitive that every web3 agent framework desperately needs and nobody has built