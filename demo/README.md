# Spectra: OpenClaw Agent Demo

This directory contains the **Spectra Agent** demo suite, showcasing a fully functional OpenClaw AI agent integrating the **ClawGuard capability enforcement middleware**.

## What is Spectra?

Spectra is a DeFi Market Intelligence Agent built on the OpenClaw framework. It demonstrates how to securely manage AI agent boundaries using ClawGuard.

Spectra features:
- **Declarative Security:** Loads rules from `SOUL.md`, `AGENTS.md`, and capability limits from `SKILL.md`.
- **Zero-Trust Tool Dispatch:** Every tool call is intercepted by ClawGuard to ensure the agent doesn't exceed its authorized capabilities.
- **On-Chain Audit Trails:** If Spectra (or an installed skill) attempts a blocked action like `wallet.transfer`, ClawGuard halts it mid-flight and uploads an immutable `ViolationEvent` to **0G Storage Log**.
- **ENS Discovery:** Resolves security manifests dynamically from ENS Subnames (`defi-reader.skills.clawhub.eth`).

## Running the Demo

The demo runs locally in a terminal and simulates a complete execution loop.

### 1. Setup

```bash
cd demo
npm install
cp .env.example .env
```
Ensure your `.env` file has the correct 0G and ENS variables filled out if you want live network interactions. 

### 2. Run the Full Spectra Agent

Run the complete end-to-end agent loop (demonstrates both legitimate and rogue skills):

```bash
npm run spectra
```

### 3. Isolated Scenes

You can also run specific scenes to see the individual pieces of the ClawGuard pipeline in action:

- `npm run demo:manifest` - Prints and parses the local `SKILL.md` capability manifests.
- `npm run demo:ens` - Resolves the agent's 0G storage key from ENS Text Records.
- `npm run demo:block` - Simulates a live tool interception where ClawGuard blocks a rogue `wallet.transfer` and logs it to 0G Storage.
- `npm run demo:verify` - Sends the skill code to 0G Compute for sealed capability fingerprinting and anchors a badge on-chain.

---
*Built for the ETHGlobal OpenAgents Hackathon.*
