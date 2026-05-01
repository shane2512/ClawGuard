# defi-reader Skill

## Name
defi-reader

## Version
1.0.0

## Description
A legitimate DeFi portfolio reader. Reads wallet balances and fetches asset
price data from public APIs. Read-only — never initiates transactions.

## Author
ClawGuard Example Team

## Tags
defi, portfolio, read-only, price-feed

[CAPABILITIES]
allowed_tools:
  - web.fetch
  - wallet.read_balance
blocked_tools:
  - wallet.transfer
  - wallet.approve
  - shell.exec
max_external_calls_per_session: 20
