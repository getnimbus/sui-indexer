package entity

import (
	"strconv"
)

type SuiIndex struct {
	DateKey          string `json:"date_key"`
	CheckpointDigest string `json:"checkpoint_digest"`
	CheckpointSeq    int64  `json:"checkpoint_seq"`
	TxDigest         string `json:"tx_digest"`
	EventSeq         int64  `json:"event_seq"`
	PackageId        string `json:"package_id"`
	EventType        string `json:"event_type"`
}

type SuiIndexKafka struct {
	Schema        map[string]interface{} `json:"schema"`
	Payload       map[string]interface{} `json:"payload"`
	CheckpointSeq string                 `json:"-"`
}

func (i *SuiIndexKafka) PartitionKey() string {
	return i.CheckpointSeq
}

func (i *SuiIndex) ToKafka() *SuiIndexKafka {
	return &SuiIndexKafka{
		Schema: map[string]interface{}{
			"type": "struct",
			"fields": []map[string]interface{}{
				{
					"type":     "string",
					"optional": true,
					"field":    "date_key",
				},
				{
					"type":     "string",
					"optional": true,
					"field":    "checkpoint_digest",
				},
				{
					"type":     "int64",
					"optional": true,
					"field":    "checkpoint_seq",
				},
				{
					"type":     "string",
					"optional": true,
					"field":    "tx_digest",
				},
				{
					"type":     "int64",
					"optional": true,
					"field":    "event_seq",
				},
				{
					"type":     "string",
					"optional": true,
					"field":    "package_id",
				},
				{
					"type":     "string",
					"optional": true,
					"field":    "event_type",
				},
			},
		},
		Payload: map[string]interface{}{
			"date_key":          i.DateKey,
			"checkpoint_digest": i.CheckpointDigest,
			"checkpoint_seq":    i.CheckpointSeq,
			"tx_digest":         i.TxDigest,
			"event_seq":         i.EventSeq,
			"package_id":        i.PackageId,
			"event_type":        i.EventType,
		},
		CheckpointSeq: strconv.FormatInt(i.CheckpointSeq, 10),
	}
}
