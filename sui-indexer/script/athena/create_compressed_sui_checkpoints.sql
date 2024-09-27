-- create raw table for checkpoints
CREATE EXTERNAL TABLE IF NOT EXISTS `raw_sui_checkpoints` (
    `epoch` bigint,
    `timestampMs` bigint,
    `sequenceNumber` bigint,
    `digest` string,
    `networkTotalTransactions` string,
    `previousDigest` string,
    `epochRollingGasCostSummary` string,
    `validatorSignature` string,
    `eventsBloom` string,
    `packagesBloom` string
)
PARTITIONED BY (`dateKey` string)
ROW FORMAT SERDE 'org.openx.data.jsonserde.JsonSerDe'
WITH SERDEPROPERTIES (
  'ignore.malformed.json' = 'TRUE',
  'dots.in.keys' = 'FALSE',
  'case.insensitive' = 'TRUE',
  'mapping' = 'TRUE'
)
STORED AS INPUTFORMAT 'org.apache.hadoop.mapred.TextInputFormat' OUTPUTFORMAT 'org.apache.hadoop.hive.ql.io.HiveIgnoreKeyTextOutputFormat'
LOCATION 's3://nimbus-sui-indexer/checkpoints/sui-checkpoints/'
TBLPROPERTIES ('classification' = 'json');

MSCK REPAIR TABLE raw_sui_checkpoints;

-- create compressed table for checkpoints
DROP TABLE IF EXISTS `final_sui_checkpoints`;

CREATE TABLE final_sui_checkpoints WITH (
   format = 'PARQUET',
   parquet_compression = 'SNAPPY',
   external_location = 's3://nimbus-sui-indexer/compressed/sui-checkpoints',
   partitioned_by = ARRAY['dateKey']
) AS SELECT * FROM raw_sui_checkpoints WHERE datekey = '2024-03-10';
