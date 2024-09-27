package gorm

import (
	"github.com/google/wire"
)

var GraphSet = wire.NewSet(
	NewBaseRepo,
	NewTransactor,
	NewBlockStatusRepo,
	NewTradeRepo,
	NewTokenRepo,
)
