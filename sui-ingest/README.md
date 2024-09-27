## SUI Ingest

SUI Ingest infrastructure

![CleanShot 2024-02-23 at 17 32 31@2x](https://i.ibb.co/kmYtdK7/Clean-Shot-2024-03-05-at-18-33-16-2x.png)

To write new SUI data ingest, you need to add a config following TS `IndexerConfig` on https://github.com/getnimbus/sui-indexer/blob/main/sui-ingest/swap/src/type.ts


### Realtime ingest
We keep the real-time data for 7 days so you can ingest the data in real time.

Example ingestion swap from multiple platforms: https://github.com/getnimbus/sui-indexer/blob/main/sui-ingest/swap/src/main.ts

### Backfill ingest
Please contact us at thanhle@getnimbus.io or @thanhle27 on TG
