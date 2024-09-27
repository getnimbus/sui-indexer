package sui_model

import (
	"strconv"

	"github.com/coming-chat/go-sui/v2/types"
	"github.com/getnimbus/ultrago/u_validator"
	"github.com/golang-module/carbon/v2"
	"github.com/samber/lo"

	"feng-sui-core/pkg/bloom"
)

/*
 * Attacking Ethereum's Bloom Filter
 * https://www.jvillella.com/ethereum-bloom-filter
 */
type Checkpoint struct {
	DateKey                    string `json:"dateKey" validate:"-"`
	Epoch                      string `json:"epoch" validate:"required"`
	SequenceNumber             string `json:"sequenceNumber" validate:"required"`
	Digest                     string `json:"digest" validate:"required"`
	TimestampMs                string `json:"timestampMs" validate:"required"`
	PreviousDigest             string `json:"previousDigest" validate:"-"`
	NetworkTotalTransactions   string `json:"networkTotalTransactions" validate:"-"`
	EpochRollingGasCostSummary struct {
		ComputationCost         string `json:"computationCost" validate:"-"`
		StorageCost             string `json:"storageCost" validate:"-"`
		StorageRebate           string `json:"storageRebate" validate:"-"`
		NonRefundableStorageFee string `json:"nonRefundableStorageFee" validate:"-"`
	} `json:"epochRollingGasCostSummary" validate:"-"`
	Transactions          []string `json:"transactions" validate:"-"`
	CheckpointCommitments []string `json:"checkpointCommitments" validate:"-"`
	ValidatorSignature    string   `json:"validatorSignature" validate:"-"`
	EventsBloom           string   `json:"eventsBloom" validate:"-"`   // 256 byte bloom filter, max is 683 events
	PackagesBloom         string   `json:"packagesBloom" validate:"-"` // 256 byte bloom filter, max is 683 events
}

func (c *Checkpoint) Validate() error {
	return u_validator.Struct(c)
}

func (c *Checkpoint) PartitionKey() string {
	return c.SequenceNumber
}

func (c *Checkpoint) WithDateKey() *Checkpoint {
	if c.DateKey != "" {
		return c
	}
	ts, err := strconv.ParseInt(c.TimestampMs, 10, 64)
	if err != nil {
		return c
	}
	c.DateKey = carbon.CreateFromTimestampMilli(ts, "UTC").ToDateString()
	return c
}

func (c *Checkpoint) SetBloomFilter(txs []*Transaction) error {
	if err := c.setEventsBloom(txs); err != nil {
		return err
	}
	if err := c.setPackagesBloom(txs); err != nil {
		return err
	}
	return nil
}

func (c *Checkpoint) setEventsBloom(txs []*Transaction) error {
	if len(txs) == 0 {
		return nil
	}

	f := bloom.CreateBloom(lo.FlatMap(txs, func(tx *Transaction, _ int) [][]byte {
		return lo.Map(tx.Events, func(event types.SuiEvent, _ int) []byte {
			return []byte(event.Type)
		})
	}))
	eventsBloom, err := f.MarshalText()
	if err != nil {
		return err
	}
	c.EventsBloom = string(eventsBloom)

	return nil
}

func (c *Checkpoint) setPackagesBloom(txs []*Transaction) error {
	if len(txs) == 0 {
		return nil
	}

	f := bloom.CreateBloom(lo.FlatMap(txs, func(tx *Transaction, _ int) [][]byte {
		return lo.Map(tx.Events, func(event types.SuiEvent, _ int) []byte {
			return event.PackageId.Data()
		})
	}))
	packagesBloom, err := f.MarshalText()
	if err != nil {
		return err
	}
	c.PackagesBloom = string(packagesBloom)

	return nil
}
