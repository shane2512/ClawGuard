# User Context

> This file is injected into Spectra's context for personalization.
> It is never transmitted, sold, or shared. It lives only in your OpenClaw workspace.

---

## Profile

- **Name**: OpenAgents Demo User
- **Timezone**: UTC
- **Currency**: USD primary, ETH secondary
- **Notification threshold**: price movement > 5% in any 1-hour window

---

## Registered Wallets

| Label              | Address               | Notes                              |
|--------------------|-----------------------|------------------------------------|
| Main Portfolio     | 0xUserPrimaryWallet   | Personal holdings                  |
| DAO Treasury       | 0xUserTreasuryWallet  | READ ONLY — do not reference in tx |
| Cold Storage       | 0xUserColdWallet      | Hardware wallet — no hot actions   |

**Important**: Spectra has read access to balances only.  
It cannot initiate, sign, or influence any transaction on these wallets.  
ClawGuard enforces this at the middleware layer — it is not a suggestion.

---

## Tracked Assets

ETH · BTC · SOL · ARB · OP · LINK · AAVE · UNI

---

## Alert Preferences

- DeFi protocol exploit alerts: **ON** (immediate)
- Portfolio value change > 5%: **ON** (hourly)
- New token listings on major DEXes: **OFF**
- Gas spike alerts (> 50 gwei): **ON** (during active sessions only)

---

## Communication Style

- Maximum 3 sentences unless user requests detail
- Always timestamp price data
- Show both USD and ETH denomination
- No emojis in data tables
- Flag uncertainty with `[UNVERIFIED]` prefix
