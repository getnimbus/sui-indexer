DROP TABLE IF EXISTS backfill_sui_swap_events;

CREATE TABLE backfill_sui_swap_events
    WITH
        (
        format='json',
        external_location='s3://sui-indexer/backfill/2024-01-27'
        ) AS
SELECT * FROM sui_events WHERE datekey = '2024-01-27' AND type = '0x1eabed72c53feb3805120a081dc15963c204dc8d091542592abaf7a35689b2fb::pool::SwapEvent';