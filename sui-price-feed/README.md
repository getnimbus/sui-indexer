# Sui price feed

Sui price feed written in Go.

## Prerequisites

- Go >= 1.22
- Postgres
- Kafka

## Installation

1. Create table in Postgres

```sql
-- Table tokens
CREATE TABLE "public"."tokens" (
    "token_address" text,
    "token_symbol" text,
    "token_name" text,
    "token_decimals" int8,
    "chain" text,
    "id" text NOT NULL,
    "created_at" timestamptz DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamptz,
    "total_supply" numeric,
    "logo" text,
    PRIMARY KEY ("id")
);

-- Table price_feeds
CREATE TABLE "public"."price_feeds" (
    "id" text NOT NULL,
    "token_address" text NOT NULL,
    "token_symbol" text,
    "token_name" text,
    "token_decimals" text,
    "chain" text NOT NULL,
    "price" numeric NOT NULL,
    "timestamp" int8 NOT NULL,
    PRIMARY KEY ("id")
);
```

2. Add `.env` file

```env
GORM_DSN=postgresql://user:password@localhost:5432/postgres?sslmode=disable
KAFKA_BROKERS=localhost:9092
KAFKA_PASSWORD=
KAFKA_USERNAME=
SUI_PRICE_FEED=sui-price-feed
```

3. You can run from `docker compose` or run from command in go

```bash
make di
go run cmd/price_feed
```
