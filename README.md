# Sui Indexer Solution

The package consists of 4 main sources:

- [Sui indexer](./sui-indexer/): indexing all on-chain data into the Data warehouse (S3 and PostgresQL).
- [Sui ingest](./sui-ingest/): consuming real-time swap trade events.
- [Sui price feed](./sui-price-feed/): providing real-time SUI token price feed.
- [Sui API](./sui-api/): exposing API for tokens, historical events, etc.
