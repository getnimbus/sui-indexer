package service

import (
	"github.com/google/wire"
)

var GraphSet = wire.NewSet(
	NewBaseService,
	NewPriceFeedService,
	NewSuiIndexer,
)
