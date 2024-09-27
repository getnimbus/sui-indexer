## Ingest SUI event and indexing Swap

We ingest to get user positions

Currently support
- Aftermath Finance
- Cetus
- FlowX
- Kriya
- Sui Swap
- Turbos Finance

There are 2 ways to get current position
- Aggr from historical
- Get from current owned object => How to detect if object is a position => How to enrich position data

## Position abstraction

### AMM
- Token A
- Token B
- Fee now and then

=> Which package is the new protocol -> Track new pool created -> Track Liquidity add/remove -> Track the users position for that AMM

Display
- Value
- Total Fee earned
- PnL (Compare to hold and compare to the total value provided) = current value + total fee earned

### CLMM
- Token A
- Token B
- Fee clamied and un-clamined
- LP range

=> Which package is the new protocol -> Track new pool created -> Track Liquidity add/remove -> Track the users position for that AMM

Display
- Value
- Range
- Total Fee earned (Claimed and un claimed)
- PnL (Compare to hold and compare to the total value provided) = current value + total fee earned

### Lending
- Token input
- Token output/position

### Borrow
- Token collateral  [Array]
- Token borrow
- Healthy state

### Stake (Same as lending just diff wording)
- Token input
- Token output/position

### Vest
- Token totally
- Amount of token vestable

### Farm
- Input token or LP position [Array]
- Token output/position

### Reward
- Token out (Point or airdrop)

=> Case by case support (API or on-chain)
