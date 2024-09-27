DROP TABLE IF EXISTS `sui_events`;

CREATE EXTERNAL TABLE IF NOT EXISTS `sui_events` (
    `id` struct<
        `txDigest`:string,
        `eventSeq`:bigint
    >,
    `timestampMs` bigint,
    `packageId` string,
    `transactionModule` string,
    `sender` string,
    `type` string,
    `bcs` string,
    `parsedJson` string
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
LOCATION 's3://sui-indexer/events/sui-events/'
TBLPROPERTIES ('classification' = 'json');

MSCK REPAIR TABLE sui_events;
