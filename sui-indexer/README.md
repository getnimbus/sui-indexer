# Feng-sui-core

Sui indexer data written in Go.

## Architecture

![Architect](./docs/architect.png?raw=true "Title")

Sui indexer includes 2 main services: master and worker. Master is responsible for fetching the latest checkpoint from the on-chain and saving it into the database (PostgreSQL). Worker will retrieve all unprocessed checkpoints from the database and fetch transactions to push down to Kafka. The purpose of separating these two services is to enable independent scaling without affecting each other. You can concurrently index both real-time checkpoints and backfill old checkpoints with just a simple configuration.

## Prerequisites

- Go >= 1.22
- Postgres
- Kafka

## Installation

1. Create table in Postgres

```sql
-- Table block_status
CREATE TABLE "public"."block_status" (
     "id" varchar NOT NULL,
     "created_at" timestamptz,
     "updated_at" timestamptz,
     "chain" varchar NOT NULL,
     "block_number" int8 NOT NULL,
     "status" int4 NOT NULL DEFAULT 0,
     "type" int4 NOT NULL DEFAULT 0,
     PRIMARY KEY ("id")
);

-- Column Comment
COMMENT ON COLUMN "public"."block_status"."status" IS '0: NOT_READY, 1: PROCESSING, 2: DONE, 3: FAILED';
COMMENT ON COLUMN "public"."block_status"."type" IS '0: REALTIME, 1: BACKFILL';

-- Table sui_index
CREATE TABLE "public"."sui_index" (
      "date_key" text,
      "checkpoint_digest" text,
      "checkpoint_seq" int8 NOT NULL,
      "tx_digest" text NOT NULL,
      "event_seq" int8 NOT NULL,
      "package_id" text,
      "event_type" text,
      PRIMARY KEY ("checkpoint_seq","tx_digest","event_seq")
);
```

2. Add `.env` file

```env
GORM_DSN=postgresql://user:password@localhost:5432/postgres?sslmode=disable
KAFKA_BROKERS=localhost:9092
KAFKA_PASSWORD=
KAFKA_USERNAME=
SUI_CHECKPOINT_TOPIC=sui-checkpoints
SUI_TXS_TOPIC=sui-txs
SUI_EVENTS_TOPIC=sui-events
SUI_INDEX_TOPIC=sui-index
SUI_RPC=https://fullnode.mainnet.sui.io
FALLBACK_SUI_RPC=https://sui-mainnet-rpc.nodereal.io
```

3. You can run from `docker compose` or run from command in go

```bash
make di
go run cmd/sui-master
go run cmd/sui-worker
```

## Backfill new protocol

1. Run athena sql to export data to s3 [athena.sql](./script/athena/export_backfill_gzip.sql)\

\*<em>Notes</em>: In Athena `UNLOAD` is not support CSV headers, you **MUST** keep the order of columns in the query.

2. Add `env`

```env
GORM_DSN=postgresql://user:password@localhost:5432/postgres?sslmode=disable
AWS_REGION=ap-southeast-1
AWS_ACCESS_KEY_ID=YourAccessKey
AWS_SECRET_ACCESS_KEY=YourSecretKey
```

3. Run [release/cli](./release/cli) to backfill data. For now, we support 2 types of backfill: `s3` and `local`

- Backfill data from S3

```bash
./cli -action SyncTrades -param1 s3 -param2 s3://sui-indexer/backfill/2024/02
```

- Backfill data from local file

```bash
./cli -action SyncTrades -param1 local -param2 ./backfill/data.csv
```
