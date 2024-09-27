CREATE TABLE "defi_clmm_lp" (
    "id" character varying NOT NULL,
    tx_hash text NOT NULL,
    owner text NOT NULL,
    position text NOT NULL,
    pool text NOT NULL,
    token_a text NOT NULL,
    token_a_quality numeric NOT NULL,
    token_a_price numeric NOT NULL,
    token_b text NOT NULL,
    token_b_quality numeric NOT NULL,
    token_b_price numeric NOT NULL,
    tickLower integer,
    tickUpper integer,
    action text NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    block integer,
    protocol text NOT NULL,
    fee numeric NOT NULL,
    native_price numeric NOT NULL,
    chain text NOT NULL,
    CONSTRAINT "PK_defi_clmm_lp" PRIMARY KEY ("id", "chain")
) PARTITION BY LIST (chain);
CREATE TABLE defi_clmm_lp_sui PARTITION OF defi_clmm_lp FOR
VALUES IN ('SUI');
CREATE TABLE "defi_amm_lp" (
    "id" VARCHAR NOT NULL,
    "tx_hash" TEXT NOT NULL,
    "owner" TEXT NOT NULL,
    "position" TEXT NOT NULL,
    "pool" TEXT NOT NULL,
    "token_a" TEXT NOT NULL,
    "token_a_quality" NUMERIC NOT NULL,
    "token_a_price" NUMERIC NOT NULL,
    "token_b" TEXT NOT NULL,
    "token_b_quality" NUMERIC NOT NULL,
    "token_b_price" NUMERIC NOT NULL,
    "lp_amount" NUMERIC NOT NULL,
    "action" TEXT NOT NULL,
    "timestamp" TIMESTAMP WITH TIME ZONE NOT NULL,
    "block" INTEGER,
    "protocol" TEXT NOT NULL,
    "fee" NUMERIC NOT NULL,
    "native_price" NUMERIC NOT NULL,
    "chain" TEXT NOT NULL,
    CONSTRAINT "PK_defi_amm_lp" PRIMARY KEY ("id", "chain")
) PARTITION BY LIST ("chain");
CREATE TABLE defi_amm_lp_sui PARTITION OF defi_amm_lp FOR
VALUES IN ('SUI');
CREATE TABLE "defi_cfmm_lp" (
    "id" VARCHAR NOT NULL,
    "tx_hash" TEXT NOT NULL,
    "owner" TEXT NOT NULL,
    "position" TEXT NOT NULL,
    "pool" TEXT NOT NULL,
    "token_input" JSON,
    "token_output" JSON,
    "lp_amount" NUMERIC NOT NULL,
    "action" TEXT NOT NULL,
    "timestamp" TIMESTAMP WITH TIME ZONE NOT NULL,
    "block" INTEGER,
    "protocol" TEXT NOT NULL,
    "fee" NUMERIC NOT NULL,
    "native_price" NUMERIC NOT NULL,
    "chain" TEXT NOT NULL,
    CONSTRAINT "PK_defi_cfmm_lp" PRIMARY KEY ("id", "chain")
) PARTITION BY LIST ("chain");
CREATE TABLE defi_cfmm_lp_sui PARTITION OF defi_cfmm_lp FOR
VALUES IN ('SUI');
CREATE TABLE "defi_stake" (
    "id" VARCHAR NOT NULL,
    "tx_hash" TEXT NOT NULL,
    "owner" TEXT NOT NULL,
    "position" TEXT NOT NULL,
    "token_input" TEXT NOT NULL,
    "token_input_quality" NUMERIC NOT NULL,
    "token_input_price" NUMERIC NOT NULL,
    "input_type" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "timestamp" TIMESTAMP WITH TIME ZONE NOT NULL,
    "block" INTEGER,
    "protocol" TEXT NOT NULL,
    "fee" NUMERIC NOT NULL,
    "native_price" NUMERIC NOT NULL,
    "chain" TEXT NOT NULL,
    CONSTRAINT "PK_defi_stake" PRIMARY KEY ("id", "chain")
) PARTITION BY LIST ("chain");
CREATE TABLE defi_stake_sui PARTITION OF defi_stake FOR
VALUES IN ('SUI');
CREATE TABLE "defi_lending" (
    "id" VARCHAR NOT NULL,
    "tx_hash" TEXT NOT NULL,
    "owner" TEXT NOT NULL,
    "position" TEXT NOT NULL,
    "token_input" TEXT NOT NULL,
    "token_input_quality" NUMERIC NOT NULL,
    "token_input_price" NUMERIC NOT NULL,
    "action" TEXT NOT NULL,
    "timestamp" TIMESTAMP WITH TIME ZONE NOT NULL,
    "block" INTEGER,
    "protocol" TEXT NOT NULL,
    "fee" NUMERIC NOT NULL,
    "native_price" NUMERIC NOT NULL,
    "chain" TEXT NOT NULL,
    CONSTRAINT "PK_defi_lending" PRIMARY KEY ("id", "chain")
) PARTITION BY LIST ("chain");
CREATE TABLE defi_lending_sui PARTITION OF defi_lending FOR
VALUES IN ('SUI');