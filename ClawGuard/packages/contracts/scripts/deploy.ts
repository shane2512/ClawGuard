import { ethers } from 'hardhat';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Deployment script for SkillRegistry.sol on 0G Chain Testnet.
 *
 * Usage:
 *   npm run deploy:testnet   (0G Chain Galileo testnet)
 *   npm run deploy:local     (local Hardhat node)
 *
 * After deployment, the contract address is saved to:
 *   ../../docs/deployments.json
 */
async function main(): Promise<void> {
  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();

  console.log('\n🚀 Deploying SkillRegistry...');
  console.log(`   Network  : ${network.name} (chainId: ${network.chainId})`);
  console.log(`   Deployer : ${deployer.address}`);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`   Balance  : ${ethers.formatEther(balance)} ETH\n`);

  if (balance === 0n) {
    throw new Error(
      'Deployer wallet has zero balance. ' +
      'Fund it at https://faucet.0g.ai before deploying.',
    );
  }

  // Deploy
  const SkillRegistry = await ethers.getContractFactory('SkillRegistry');
  const registry = await SkillRegistry.deploy();
  await registry.waitForDeployment();

  const address = await registry.getAddress();
  const deployTx = registry.deploymentTransaction();

  console.log(`✅ SkillRegistry deployed!`);
  console.log(`   Contract : ${address}`);
  console.log(`   Tx Hash  : ${deployTx?.hash}`);
  console.log(`   Explorer : https://chainscan-galileo.0g.ai/address/${address}\n`);

  // Save deployment info
  const deploymentsPath = path.resolve(__dirname, '../../../docs/deployments.json');
  let deployments: Record<string, unknown> = {};
  if (fs.existsSync(deploymentsPath)) {
    deployments = JSON.parse(fs.readFileSync(deploymentsPath, 'utf-8')) as Record<string, unknown>;
  }

  deployments[network.chainId.toString()] = {
    network: network.name,
    chainId: network.chainId.toString(),
    SkillRegistry: {
      address,
      txHash: deployTx?.hash,
      deployedAt: new Date().toISOString(),
    },
  };

  fs.writeFileSync(deploymentsPath, JSON.stringify(deployments, null, 2));
  console.log(`📄 Deployment info saved to: docs/deployments.json`);
  console.log(`\n⚠️  Add this to your .env file:\n   REGISTRY_ADDRESS=${address}\n`);
}

main().catch((err) => {
  console.error('Deployment failed:', err);
  process.exit(1);
});
