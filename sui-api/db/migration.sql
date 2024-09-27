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