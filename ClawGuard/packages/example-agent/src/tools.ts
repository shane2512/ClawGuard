/**
 * Mock tool registry — simulates OpenClaw's Tool Integration layer (Layer 3).
 *
 * In a real OpenClaw agent, these would be actual tool implementations.
 * Here they are mocks that log what they would do, so the demo runs safely
 * without real wallets or network calls (Rule S-04: no real funds in demo).
 */

export interface ToolResult {
  tool: string;
  success: boolean;
  data?: unknown;
  error?: string;
}

/** Mock tool implementations keyed by tool name */
const TOOL_IMPLEMENTATIONS: Record<
  string,
  (params: Record<string, unknown>) => Promise<ToolResult>
> = {
  'wallet.read_balance': async (params) => {
    const address = (params['address'] as string) ?? '0xDEMO...';
    // Simulate a read-only balance check — safe mock
    const mockBalance = (Math.random() * 10).toFixed(4);
    console.log(`  [tool] wallet.read_balance(${address}) → ${mockBalance} ETH`);
    return {
      tool: 'wallet.read_balance',
      success: true,
      data: { address, balance: mockBalance, unit: 'ETH' },
    };
  },

  'web.fetch': async (params) => {
    const url = (params['url'] as string) ?? 'https://api.coingecko.com/...';
    // Simulate a price feed fetch — safe mock
    const mockPrice = (1800 + Math.random() * 200).toFixed(2);
    console.log(`  [tool] web.fetch(${url}) → ETH/USD: $${mockPrice}`);
    return {
      tool: 'web.fetch',
      success: true,
      data: { url, price: mockPrice, currency: 'USD', asset: 'ETH' },
    };
  },

  'web.search': async (params) => {
    const query = (params['query'] as string) ?? '';
    console.log(`  [tool] web.search("${query}") → [mock search results]`);
    return {
      tool: 'web.search',
      success: true,
      data: { query, results: ['result1', 'result2', 'result3'] },
    };
  },

  // !! DANGEROUS TOOL — should NEVER execute if ClawGuard is active !!
  'wallet.transfer': async (params) => {
    const to = (params['to'] as string) ?? '0xUNKNOWN';
    const amount = (params['amount'] as string) ?? '???';
    // If this runs, ClawGuard has FAILED. In a real attack, funds would be gone.
    console.error(`  ⚠️  [tool] wallet.transfer → to: ${to}, amount: ${amount} ETH`);
    console.error(`  ⚠️  THIS IS THE ATTACK — IN PRODUCTION, FUNDS WOULD BE STOLEN`);
    return {
      tool: 'wallet.transfer',
      success: true, // attack "succeeded" because ClawGuard wasn't active
      data: { to, amount, txHash: '0xFAKE_TX_HASH' },
    };
  },

  'wallet.approve': async (params) => {
    console.error(`  ⚠️  [tool] wallet.approve → spender: ${params['spender']} — DANGEROUS`);
    return { tool: 'wallet.approve', success: true, data: params };
  },

  'shell.exec': async (params) => {
    console.error(`  ⚠️  [tool] shell.exec → cmd: ${params['cmd']} — EXTREMELY DANGEROUS`);
    return { tool: 'shell.exec', success: true, data: { output: 'MOCK_OUTPUT' } };
  },
};

/**
 * The base tool_dispatch function — equivalent to OpenClaw's Layer 3.
 * ClawGuard wraps this function (it does not modify it).
 *
 * @param toolName - Name of the tool to execute
 * @param params   - Parameters to pass to the tool
 * @returns Tool execution result
 */
export async function baseToolDispatch(
  toolName: string,
  params: Record<string, unknown>,
): Promise<ToolResult> {
  const impl = TOOL_IMPLEMENTATIONS[toolName];
  if (!impl) {
    console.error(`  [tool] Unknown tool: "${toolName}"`);
    return {
      tool: toolName,
      success: false,
      error: `Tool "${toolName}" is not registered in this agent`,
    };
  }
  return impl(params);
}
