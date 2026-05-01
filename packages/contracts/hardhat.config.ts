import { HardhatUserConfig } from 'hardhat/config';
import '@nomicfoundation/hardhat-toolbox';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env from monorepo root
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const ZG_CHAIN_RPC = process.env['ZG_CHAIN_RPC'] ?? 'https://evmrpc-testnet.0g.ai';
const ZG_PRIVATE_KEY = process.env['ZG_PRIVATE_KEY'] ?? '0x0000000000000000000000000000000000000000000000000000000000000001';

const config: HardhatUserConfig = {
  solidity: {
    version: '0.8.24',
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    // 0G Chain Testnet (Galileo)
    zgTestnet: {
      url: ZG_CHAIN_RPC,
      chainId: 16602,
      accounts: [ZG_PRIVATE_KEY],
      gasPrice: 'auto',
    },
    // Local Hardhat node for development
    localhost: {
      url: 'http://127.0.0.1:8545',
      chainId: 31337,
    },
    // Hardhat in-process (for tests)
    hardhat: {
      chainId: 31337,
    },
  },
  paths: {
    sources: './contracts',
    tests: './test',
    cache: './cache',
    artifacts: './artifacts',
  },
  typechain: {
    outDir: 'typechain-types',
    target: 'ethers-v6',
  },
};

export default config;
