/**
 * fix-ens-hash.ts
 * One-shot script to update clawguard.manifestHash ENS text record
 * to match the actual SHA-256 of the manifest stored on 0G Storage.
 */

import pc from 'picocolors';
import { config } from '../config';

const CORRECT_HASH = '0xf9f4b248cc1de124a3875ed7ad184291be9f11b9508a020f9a16d76d4ff91060';
const ENS_NAME     = 'defi-reader.skills.clawhub.eth';

async function main() {
  console.log(pc.bold(pc.cyan('\n  Fixing ENS manifestHash record...\n')));
  console.log(pc.dim(`  ENS Name  : ${ENS_NAME}`));
  console.log(pc.dim(`  New Hash  : ${CORRECT_HASH}\n`));

  const { createWalletClient, createPublicClient, http } = await import('viem');
  const { sepolia } = await import('viem/chains');
  const { privateKeyToAccount } = await import('viem/accounts');
  const { addEnsContracts, ensWalletActions } = await import('@ensdomains/ensjs');
  const { setTextRecord } = await import('@ensdomains/ensjs/wallet');

  const account = privateKeyToAccount(config.privateKey as `0x${string}`);
  console.log(pc.dim(`  Wallet    : ${account.address}`));

  const walletClient = createWalletClient({
    account,
    chain: addEnsContracts(sepolia),
    transport: http(config.sepoliaRpc),
  }).extend(ensWalletActions);

  console.log(pc.yellow('  Sending setTextRecord tx...'));

  const hash = await setTextRecord(walletClient, {
    name: ENS_NAME as `${string}.eth`,
    key: 'clawguard.manifestHash',
    value: CORRECT_HASH,
    account,
  });

  console.log(pc.green(`\n  ✅ ENS text record updated!`));
  console.log(pc.dim(`  Tx hash   : ${hash}`));
  console.log(pc.dim(`  Sepolia   : https://sepolia.etherscan.io/tx/${hash}`));
  console.log(pc.dim('\n  Wait ~30s for confirmation, then re-run: npm run demo:ens\n'));
}

main().catch((err) => {
  console.error(pc.red('\n[fix-ens-hash] Fatal:'), err);
  process.exit(1);
});
