package entity

import (
	"fmt"

	"github.com/getnimbus/ultrago/u_validator"
)

const (
	BlockStatusType_REALTIME = 0
	BlockStatusType_BACKFILL = 1
)

const (
	BlockStatus_NOT_READY = iota
	BlockStatus_PROCESSING
	BlockStatus_DONE
	BlockStatus_FAIL
)

type BlockStatus struct {
	Base
	Chain       string `json:"chain" validate:"required"`
	BlockNumber int64  `json:"block_number" validate:"required"`
	Status      int    `json:"status" validate:"required"`
	Type        int    `json:"type" validate:"-"`
}

func (b *BlockStatus) Validate() error {
	if err := u_validator.Struct(b); err != nil {
		return err
	}

	switch b.Status {
	case BlockStatus_NOT_READY,
		BlockStatus_PROCESSING,
		BlockStatus_DONE,
		BlockStatus_FAIL:
	default:
		return fmt.Errorf("invalid status %v", b.Status)
	}

	switch b.Type {
	case BlockStatusType_REALTIME,
		BlockStatusType_BACKFILL:
	default:
		return fmt.Errorf("invalid type %v", b.Type)
	}

	return nil
}
