package sui_model

import (
	"fmt"

	"github.com/coming-chat/go-sui/v2/types"
	"github.com/golang-module/carbon/v2"
)

type Event struct {
	types.SuiEvent
	DateKey    string      `json:"dateKey"`
	Checkpoint string      `json:"checkpoint"`
	GasUsed    interface{} `json:"gasUsed"`
}

func (e *Event) PartitionKey() string {
	return fmt.Sprintf("%s-%s", e.Checkpoint, e.Id.TxDigest.String())
}

func (e *Event) WithDateKey() *Event {
	if e.DateKey != "" {
		return e
	}
	e.DateKey = carbon.CreateFromTimestampMilli(e.TimestampMs.Int64(), "UTC").ToDateString()
	return e
}

func (e *Event) WithCheckpoint(checkpoint string) *Event {
	e.Checkpoint = checkpoint
	return e
}

func (e *Event) WithGasUsed(gasUsed interface{}) *Event {
	e.GasUsed = gasUsed
	return e
}
