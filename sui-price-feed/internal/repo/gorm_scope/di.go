package gorm_scope

import (
	"github.com/google/wire"
)

var GraphSet = wire.NewSet(
	NewBase,
	NewToken,
	NewPriceFeed,
)
