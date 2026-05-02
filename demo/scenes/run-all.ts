/**
 * run-all.ts — Runs all 5 demo scenes sequentially with separators.
 * Use this for a single end-to-end recording if needed.
 */

import pc from 'picocolors';

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function divider(n: number, title: string) {
  const line = '='.repeat(64);
  console.log('\n\n' + pc.bold(pc.cyan(line)));
  console.log(pc.bold(pc.cyan(`  SCENE ${n}: ${title}`)));
  console.log(pc.bold(pc.cyan(line)) + '\n');
}

async function runScene(file: string) {
  // Dynamic require so each scene runs in the same process
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  require(file);
  // Wait for async main() to complete
  await sleep(2000);
}

async function main() {
  console.log(pc.bold(pc.cyan('\n  ClawGuard — Full End-to-End Demo\n')));
  console.log(pc.dim('  Running all 5 scenes sequentially...\n'));

  divider(1, 'THE PROBLEM — No Capability Enforcement');
  await import('./01-problem');
  await sleep(2000);

  divider(2, 'THE MANIFEST FORMAT');
  await import('./02-show-manifest');
  await sleep(2000);

  divider(3, 'ENS -> 0G STORAGE RESOLUTION');
  await import('./03-ens-resolve');
  await sleep(2000);

  divider(4, 'CLAWGUARD MIDDLEWARE BLOCKING');
  await import('./04-middleware-block');
  await sleep(2000);

  divider(5, '0G COMPUTE FINGERPRINT + ON-CHAIN BADGE');
  await import('./05-onchain-verify');
  await sleep(1000);

  console.log(pc.bold(pc.green('\n\n  All scenes complete. ClawGuard demo finished.\n')));
}

main().catch((err) => {
  console.error(pc.red('\n[run-all] Fatal:'), err);
  process.exit(1);
});
