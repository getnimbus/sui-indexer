SELECT json_extract(unnested_event, '$.id') as id,
    json_extract_scalar(unnested_event, '$.type') as type,
    json_extract_scalar(unnested_event, '$.packageid') as packageId,
    json_extract_scalar(unnested_event, '$.transactionmodule') as transactionModule,
    json_extract_scalar(unnested_event, '$.sender') as sender,
    json_extract(unnested_event, '$.parsedjson') as parsedJson,
    timestampms as timestampMs,
    datekey as dateKey,
    checkpoint,
    json_extract(effects, '$.gasused') as gasUsed
FROM final_sui_txs
    CROSS JOIN (
        UNNEST(
            CAST(
                json_extract(events, '$') AS ARRAY(JSON)
            )
        )
    ) AS t(unnested_event)
where starts_with(
        json_extract_scalar(unnested_event, '$.type'),
        '0xdc15721baa82ba64822d585a7349a1508f76d94ae80e899b06e48369c257750e::swap_cap::SwapCompletedEvent' -- cetus
    )
    or starts_with(
        json_extract_scalar(unnested_event, '$.type'),
        '0xefe170ec0be4d762196bedecd7a065816576198a6527c99282a2551aaa7da38c::events::SwapEvent' -- aftermatch
    )
    or starts_with(
        json_extract_scalar(unnested_event, '$.type'),
        '0x1eabed72c53feb3805120a081dc15963c204dc8d091542592abaf7a35689b2fb::pool::SwapEvent' -- flowx
    )
    or starts_with(
        json_extract_scalar(unnested_event, '$.type'),
        '0xba153169476e8c3114962261d1edc70de5ad9781b83cc617ecc8c1923191cae0::pair::Swapped' -- kryza
    )
    or starts_with(
        json_extract_scalar(unnested_event, '$.type'),
        '0xa0eba10b173538c8fecca1dff298e488402cc9ff374f8a12ca7758eebe830b66::spot_dex::SwapEvent' -- suiswawp
    )
    or starts_with(
        json_extract_scalar(unnested_event, '$.type'),
        '0x91bfbc386a41afcfd9b2533058d7e915a1d3829089cc268ff4333d54d6339ca1::pool::SwapEvent' -- turbos
    )
    or starts_with(
        json_extract_scalar(unnested_event, '$.type'),
        '0x361dd589b98e8fcda9a7ee53b85efabef3569d00416640d2faa516e3801d7ffc::pool::SwapTokenEvent' -- turbos
    )
    or starts_with(
        json_extract_scalar(unnested_event, '$.type'),
        '0xb24b6789e088b876afabca733bed2299fbc9e2d6369be4d1acfa17d8145454d9::swap::Swap_Event' -- turbos
    )
    and dateKey < DATE('2024-03-25');