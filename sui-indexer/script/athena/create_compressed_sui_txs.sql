-- create raw table for txs
CREATE EXTERNAL TABLE IF NOT EXISTS `raw_sui_txs` (
    `digest` string,
    `timestampMs` bigint,
    `checkpoint` bigint,
    `transaction` string,
    `effects` string,
    `events` string,
    `objectChanges` string,
    `balanceChanges` string
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
LOCATION 's3://nimbus-sui-indexer/txs/sui-txs/'
TBLPROPERTIES ('classification' = 'json');

MSCK REPAIR TABLE raw_sui_txs;

-- create compressed table for txs
DROP TABLE IF EXISTS `final_sui_txs`;

CREATE TABLE final_sui_txs WITH (
   format = 'PARQUET',
   parquet_compression = 'SNAPPY',
   external_location = 's3://nimbus-sui-indexer/compressed/sui-txs',
   partitioned_by = ARRAY['dateKey']
) AS SELECT * FROM raw_sui_txs WHERE datekey = '2024-03-10';
