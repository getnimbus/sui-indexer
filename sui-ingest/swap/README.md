## Ingest SUI event and indexing Swap

We ingest Sui Swap event and then index to Postgres DB

Currently support
- Aftermath Finance
- Cetus
- FlowX
- Kriya
- Sui Swap
- Turbos Finance
- BlueMove

For the backfill flow, we need to export CSV data and run it one time. Please contact our team to get backfill data

## Run Docker
Add .env file from .env.example

```
docker run --env-file .env -d ghcr.io/getnimbus/sui-indexer_sui-ingest-swap:main
```

## Docker backfill
1. Add .env
2. Run command

```
docker run --env-file .env -v .:/data ghcr.io/getnimbus/sui-indexer_sui-ingest-swap:main
```