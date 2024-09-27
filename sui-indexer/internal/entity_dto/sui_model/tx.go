package sui_model

import (
	"strconv"

	"github.com/coming-chat/go-sui/v2/types"
	"github.com/getnimbus/ultrago/u_validator"
	"github.com/golang-module/carbon/v2"
)

type Transaction struct {
	DateKey        string                 `json:"dateKey" validate:"-"`
	Checkpoint     string                 `json:"checkpoint" validate:"required"`
	Digest         string                 `json:"digest" validate:"required"`
	TimestampMs    string                 `json:"timestampMs" validate:"required"`
	Transaction    map[string]interface{} `json:"transaction" validate:"-"`
	Effects        map[string]interface{} `json:"effects" validate:"-"`
	Events         []types.SuiEvent       `json:"events" validate:"-"`
	ObjectChanges  []interface{}          `json:"objectChanges" validate:"-"`
	BalanceChanges []interface{}          `json:"balanceChanges" validate:"-"`
}

func (tx *Transaction) Validate() error {
	return u_validator.Struct(tx)
}

func (tx *Transaction) PartitionKey() string {
	return tx.Checkpoint
}

func (tx *Transaction) WithDateKey() *Transaction {
	if tx.DateKey != "" {
		return tx
	}
	ts, err := strconv.ParseInt(tx.TimestampMs, 10, 64)
	if err != nil {
		return tx
	}
	tx.DateKey = carbon.CreateFromTimestampMilli(ts, "UTC").ToDateString()
	return tx
}
