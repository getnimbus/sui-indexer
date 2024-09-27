DROP TABLE IF EXISTS `sui_checkpoints`;

CREATE EXTERNAL TABLE IF NOT EXISTS `sui_checkpoints` (
    `epoch` bigint,
    `timestampMs` bigint,
    `sequenceNumber` bigint,
    `digest` string,
    `networkTotalTransactions` string,
    `previousDigest` string,
    `epochRollingGasCostSummary` struct<
        `computationCost`:string,
        `storageCost`:string,
        `storageRebate`:string,
        `nonRefundableStorageFee`:string
    >,
    `validatorSignature` string,
    `eventsBloom` string,
    `packagesBloom` string
)
PARTITIONED BY (`dateKey` string)
ROW FORMAT SERDE 'org.openx.data.jsonserde.JsonSerDe'
WITH SERDEPROPERTIES (
  'ignore.malformed.json' = 'FALSE',
  'dots.in.keys' = 'FALSE',
  'case.insensitive' = 'TRUE',
  'mapping' = 'TRUE'
)
STORED AS INPUTFORMAT 'org.apache.hadoop.mapred.TextInputFormat' OUTPUTFORMAT 'org.apache.hadoop.hive.ql.io.HiveIgnoreKeyTextOutputFormat'
LOCATION 's3://sui-indexer/checkpoints/sui-checkpoints/'
TBLPROPERTIES ('classification' = 'json');

MSCK REPAIR TABLE sui_checkpoints;

EXPLAIN ANALYZE SELECT * FROM sui_checkpoints WHERE datekey = '2024-01-27';
