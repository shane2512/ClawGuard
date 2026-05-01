/**
 * Phase 2.4: 0G Compute Sealed Inference — Skill Capability Verification
 *
 * Uses @0gfoundation/0g-compute-ts-sdk (createInferenceBroker)
 * to send skill source code to a TEE-backed AI model and extract
 * the actual tools it invokes. Compares against declared [CAPABILITIES].
 *
 * Verification result is then written to SkillRegistry.sol on-chain.
 */

import { ethers } from 'ethers';
import { CapabilityManifest, VerificationStatus } from '@clawguard/core';

export interface VerificationResult {
  skillId: string;
  status: VerificationStatus;
  /** Tools found in code but NOT declared in allowed_tools */
  undeclaredTools: string[];
  /** All tools the AI found invoked in the skill code */
  invokedTools: string[];
  /** Provider address used for inference */
  providerAddress?: string;
}

// ─── Prompt template ─────────────────────────────────────────────────────────

function buildVerificationPrompt(skillCode: string): string {
  return `Analyze this OpenClaw skill code carefully and return ONLY a valid JSON object with no explanation, no markdown, no preamble, no code fences.

The JSON must have exactly one key: "invokedTools" whose value is an array of strings — each string is the exact tool name called in the code.

Look for any calls to tool names in the format: "category.action" (e.g. "wallet.transfer", "web.fetch", "shell.exec", "wallet.read_balance").

Code:
${skillCode}`;
}

// ─── Main verify function ─────────────────────────────────────────────────────

/**
 * Verifies a skill's source code against its declared capabilities
 * using 0G Compute sealed inference.
 *
 * @param skillCode - Full source code of the skill to analyze
 * @param manifest  - The skill's declared CapabilityManifest
 * @returns VerificationResult with VERIFIED or CAPABILITY_MISMATCH status
 */
export async function verifySkillWithCompute(
  skillCode: string,
  manifest: CapabilityManifest,
): Promise<VerificationResult> {
  const privateKey = process.env['ZG_PRIVATE_KEY'];
  const rpcUrl = process.env['ZG_CHAIN_RPC'] ?? 'https://evmrpc-testnet.0g.ai';

  if (!privateKey || privateKey.includes('YOUR_PRIVATE_KEY')) {
    throw new Error('ZG_PRIVATE_KEY is not set in .env');
  }

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const signer = new ethers.Wallet(privateKey, provider);

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { createInferenceBroker, CONTRACT_ADDRESSES } = require('@0gfoundation/0g-compute-ts-sdk');
  const inferenceAddr = CONTRACT_ADDRESSES.testnet.inference;
  const ledgerAddr = CONTRACT_ADDRESSES.testnet.ledger;

  console.log('[0G Compute] Initializing inference broker...');
  const broker = await createInferenceBroker(signer, inferenceAddr, ledgerAddr);

  // List available providers — listService() is on broker directly
  console.log('[0G Compute] Fetching available inference services...');
  const services = await broker.listService();

  if (!services || services.length === 0) {
    throw new Error('No inference providers available on 0G Compute network.');
  }

  // Pick the first healthy chat service
  const service = services.find(
    (s: { type?: string; model?: string }) =>
      s.type === 'chatbot' || s.model?.toLowerCase().includes('llama') ||
      s.model?.toLowerCase().includes('qwen') || s.model?.toLowerCase().includes('gpt'),
  ) ?? services[0];

  const providerAddress: string = service.provider;
  console.log(`[0G Compute] Using provider: ${providerAddress} | Model: ${service.model}`);

  // Ensure provider sub-account exists
  try {
    await broker.getAccount(providerAddress);
  } catch {
    console.log('[0G Compute] No sub-account found. Creating and funding...');
    await broker.depositFund(providerAddress, ethers.parseEther('0.001'));
  }

  // Build prompt and get request headers
  const prompt = buildVerificationPrompt(skillCode);
  const headers = await broker.getRequestHeaders(providerAddress, prompt);

  // Get service endpoint
  const { endpoint, model } = await broker.getServiceMetadata(providerAddress);

  // Make the inference request
  console.log('[0G Compute] Sending skill code for sealed inference analysis...');
  const response = await fetch(`${endpoint}/chat/completions`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 500,
      temperature: 0,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`0G Compute inference failed (${response.status}): ${body}`);
  }

  const data = await response.json() as {
    choices: Array<{ message: { content: string } }>;
  };

  // Process response for fee settlement (required by broker protocol)
  try {
    await broker.inference.processResponse(providerAddress, data, prompt);
  } catch (err) {
    console.warn('[0G Compute] Fee settlement warning:', err);
  }

  // Parse AI response
  const rawContent = data.choices[0]?.message?.content ?? '{}';
  let invokedTools: string[] = [];

  try {
    // Strip markdown fences if present
    const cleaned = rawContent.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleaned) as { invokedTools?: string[] };
    invokedTools = parsed.invokedTools ?? [];
  } catch {
    console.warn('[0G Compute] Failed to parse JSON response, trying regex extraction...');
    // Fallback: extract tool names via regex
    const matches = rawContent.match(/"[\w.]+"/g) ?? [];
    invokedTools = matches.map((m: string) => m.replace(/"/g, ''));
  }

  console.log(`[0G Compute] Detected invoked tools: ${JSON.stringify(invokedTools)}`);

  // Compare detected vs declared
  const declaredTools = [
    ...manifest.allowedTools,
    ...manifest.blockedTools,
  ];
  const undeclaredTools = invokedTools.filter((t) => !declaredTools.includes(t));

  const status =
    undeclaredTools.length === 0 ? VerificationStatus.VERIFIED : VerificationStatus.CAPABILITY_MISMATCH;

  console.log(`[0G Compute] Verification result: ${status}`);
  if (undeclaredTools.length > 0) {
    console.log(`[0G Compute] Undeclared tools found: ${undeclaredTools.join(', ')}`);
  }

  return { skillId: manifest.skillId, status, undeclaredTools, invokedTools, providerAddress };
}
