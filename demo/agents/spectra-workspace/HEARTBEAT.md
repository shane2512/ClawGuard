# Spectra — Heartbeat Schedule

> Heartbeat tasks run autonomously on a schedule, independent of user requests.
> All heartbeat tool calls are subject to ClawGuard enforcement.
> Session IDs for heartbeat runs are prefixed: `heartbeat-<YYYY-MM-DD>-<slot>`

---

## Every 15 Minutes (during market hours: 00:00–23:59 UTC)

```
TASK: price-pulse
TOOLS: web.fetch
TRIGGER: */15 * * * *
```

- Fetch spot prices: ETH/USD, BTC/USD, SOL/USD
- Compute 15-minute delta (vs previous heartbeat)
- If any asset moved ±3% in 15 minutes: flag for ALERT
- Store result in session context (transient, not persisted)

---

## Every Hour

```
TASK: portfolio-snapshot
TOOLS: web.fetch, wallet.read_balance
TRIGGER: 0 * * * *
```

- Fetch latest prices for all tracked assets (ETH, BTC, SOL, ARB, OP, LINK)
- Fetch balance for each registered wallet
- Compute USD portfolio value
- Compute 24h change in portfolio value
- If change > ±5%: generate summary report for user

---

## Every Day at 08:00 UTC

```
TASK: daily-intelligence-brief
TOOLS: web.fetch, web.search
TRIGGER: 0 8 * * *
```

- Pull top DeFi protocol TVL changes (DeFiLlama)
- Search for overnight DeFi security incidents or exploits
- Summarize major protocol yield changes
- Generate a 3-point daily brief

---

## Conditions and Safety Rules

- All heartbeat sessions use skill `defi-reader` (read-only manifest)
- If ClawGuard blocks any heartbeat tool call: log violation, skip task, continue
- If the manifest cannot be fetched: cancel all heartbeat tasks until resolved
- Heartbeat tasks NEVER use write tools — not in any circumstance
- Max 3 retries per failed tool call, then skip with error logged

---

## Disabled Tasks

```
# wallet.transfer-based-rebalancing  [DISABLED — not in capability manifest]
# shell.exec-based-reporting         [DISABLED — not in capability manifest]
# wallet.approve-for-yield           [DISABLED — not in capability manifest]
```

These tasks were proposed during Spectra's design phase and explicitly excluded.  
ClawGuard would block them anyway — they are documented here for audit trail purposes.
