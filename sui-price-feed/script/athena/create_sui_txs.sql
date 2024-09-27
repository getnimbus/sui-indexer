DROP TABLE IF EXISTS `sui_txs`;

CREATE EXTERNAL TABLE IF NOT EXISTS `sui_txs` (
    `digest` string,
    `timestampMs` bigint,
    `checkpoint` bigint,
    `transaction` struct<
        `data`:string,
        `txSignatures`:string
    >,
    `effects` struct<
        `messageVersion`:string,
        `status`:struct<`status`:string>,
        `executedEpoch`:bigint,
        `modifiedAtVersions`:array<struct<
            `objectId`:string,
            `sequenceNumber`:bigint
        >>,
        `transactionDigest`:string,
        `mutated`:string,
        `gasUsed`:struct<
            `computationCost`:string,
            `storageCost`:string,
            `storageRebate`:string,
            `nonRefundableStorageFee`:string
        >,
        `sharedObjects`:array<struct<
            `objectId`:string,
            `version`:bigint,
            `digest`:string
        >>,
        `gasObject`:string,
        `eventsDigest`:string,
        `dependencies`:array<string>
    >,
    `events` array<struct<
        `id`:struct<`txDigest`:string, `eventSeq`:string>,
        `packageId`:string,
        `transactionModule`:string,
        `sender`:string,
        `type`:string,
        `parsedJson`:string,
        `bcs`:string
    >>,
    `objectChanges` array<struct<
        `digest`:string,
        `type`:string,
        `sender`:string,
        `owner`:struct<
            `ObjectOwner`:string,
            `Shared`:struct<`initial_shared_version`:bigint>
        >,
        `objectType`:string,
        `objectId`:string,
        `version`:bigint,
        `previousVersion`:string
    >>,
    `balanceChanges` array<struct<
        `owner`:string,
        `coinType`:string,
        `amount`:string
    >>
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
LOCATION 's3://sui-indexer/txs/sui-txs/'
TBLPROPERTIES ('classification' = 'json');

MSCK REPAIR TABLE sui_txs;
