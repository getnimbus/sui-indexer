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