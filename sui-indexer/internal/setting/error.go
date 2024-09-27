package setting

import "errors"

var (
	// internal
	MissingConditionErr      error
	TransactionInProgressErr error
	TransactionNotStartedErr error
	DuplicatedRecordsErr     error
)

func init() {
	MissingConditionErr = errors.New("missing conditions")
	TransactionInProgressErr = errors.New("transaction already in progress")
	TransactionNotStartedErr = errors.New("transaction not started")
	DuplicatedRecordsErr = errors.New("duplicated records")
}
