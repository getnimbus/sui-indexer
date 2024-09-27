CREATE TABLE tmp_2024_02
    WITH (
        format = 'TEXTFILE',
        field_delimiter = ',',
        external_location = 's3://sui-indexer/backfill/2024/02/',
--         write_compression = 'NONE',
        bucketed_by = ARRAY['datekey'],
        bucket_count = 1)
AS (
   WITH dataset AS (
       SELECT *
       FROM sui_txs
       WHERE datekey = '2024-02-12'
    ),
    sui_events AS (
                      SELECT
                      checkpoint AS block,
                      digest AS tx_hash,
                      timestampms,
                      event,
                      datekey
                      FROM
                      dataset,
                      UNNEST(dataset.events) AS t(event)
    )
    SELECT
        datekey,
        block,
        tx_hash,
        json_extract_scalar(event.parsedJson, '$.types_in[0]') AS from_token_address,
        json_extract_scalar(event.parsedJson, '$.types_out[0]') AS to_token_address,
        CAST('' AS VARCHAR) as sender_address,
        json_extract_scalar(event.parsedJson, '$.issuer') as origin_sender_address,
        json_extract_scalar(event.parsedJson, '$.amounts_in[0]') as quanlity_in,
        json_extract_scalar(event.parsedJson, '$.amounts_out[0]') as quanlity_out,
        event.id.eventSeq as log_index,
        'AftermathFinance' as exchange_name,
        timestampms AS "timestamp",
        'AftermathFinance' as pool_address,
        0 as amount_usd,
        'SUI' as chain,
        0 as fee,
        0 as native_price
    FROM sui_events
    WHERE event.type = '0xefe170ec0be4d762196bedecd7a065816576198a6527c99282a2551aaa7da38c::events::SwapEvent'
    LIMIT 10
);