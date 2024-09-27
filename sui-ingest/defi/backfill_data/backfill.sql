SELECT digest,
    unnested_event.id as id,
    unnested_event.packageid as packageId,
    unnested_event.transactionmodule as transactionModule,
    unnested_event.sender,
    unnested_event.type as type,
    unnested_event.parsedjson as parsedJson,
    timestampms as timestampMs,
    datekey as dateKey,
    checkpoint,
    effects.gasUsed as gasUsed -- unnested_event
FROM sui_txs
    CROSS JOIN UNNEST(events) AS t(unnested_event)
where starts_with(
        unnested_event.type,
        '0x1eabed72c53feb3805120a081dc15963c204dc8d091542592abaf7a35689b2fb::pool::SwapEvent' -- cetus
    )
    or starts_with(
        unnested_event.type,
        '0xdc15721baa82ba64822d585a7349a1508f76d94ae80e899b06e48369c257750e::swap_cap::SwapCompletedEvent' -- aftermatch
    )
    or starts_with(
        unnested_event.type,
        '0xba153169476e8c3114962261d1edc70de5ad9781b83cc617ecc8c1923191cae0::pair::Swapped' -- flowx
    )
    or starts_with(
        unnested_event.type,
        '0xa0eba10b173538c8fecca1dff298e488402cc9ff374f8a12ca7758eebe830b66::spot_dex::SwapEvent' -- kryza
    )
    or starts_with(
        unnested_event.type,
        '0x361dd589b98e8fcda9a7ee53b85efabef3569d00416640d2faa516e3801d7ffc::pool::SwapTokenEvent' -- suiswawp
    )
    or starts_with(
        unnested_event.type,
        '0x91bfbc386a41afcfd9b2533058d7e915a1d3829089cc268ff4333d54d6339ca1::pool::SwapEvent' -- turbos
    )
limit 10;