/**
 * /demo/config.ts
 *
 * Single source of truth for all environment variables used in demo scenes.
 * Loads from the PARENT project .env first, falls back to local .env.
 * Never read process.env directly in scene files — always import from here.
 */

import * as path from 'path';
import * as dotenv from 'dotenv';

// Load parent project .env (the real one with actual credentials)
dotenv.config({ path: path.resolve(__dirname, '../.env') });
// Fallback: load local .env if present (for standalone demo usage)
dotenv.config({ path: path.resolve(__dirname, '.env') });

function required(key: string): string {
  const val = process.env[key];
  if (!val || val.trim() === '') {
    throw new Error(`Missing required env var: ${key}\nCopy .env.example to .env and fill in the value.`);
  }
  return val.trim();
}

function optional(key: string, fallback = ''): string {
  return (process.env[key] ?? fallback).trim();
}

export const config = {
  // 0G Chain
  privateKey:       required('ZG_PRIVATE_KEY'),
  chainRpc:         required('ZG_CHAIN_RPC'),
  chainId:          parseInt(optional('ZG_CHAIN_ID', '16602'), 10),

  // 0G Storage
  indexerRpc:       required('ZG_INDEXER_RPC'),
  flowContract:     optional('ZG_FLOW_CONTRACT', '0x22E03a6A89B950F1c82ec5e74F8eCa321a105296'),

  // 0G Compute
  computeRpc:       optional('ZG_COMPUTE_RPC', process.env['ZG_CHAIN_RPC'] ?? ''),

  // Registry
  registryAddress:  optional('REGISTRY_ADDRESS', ''),

  // ENS
  sepoliaRpc:       required('ETH_SEPOLIA_RPC'),
  ensSkillName:     optional('ENS_SKILL_NAME', 'defi-reader.skills.clawhub.eth'),

  // Demo
  agentId:          optional('AGENT_ID', 'clawguard-demo-agent'),
} as const;
