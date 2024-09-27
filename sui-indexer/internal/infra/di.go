package infra

import (
	"github.com/google/wire"
)

var GraphSet = wire.NewSet(
	NewRedisClient,
	NewPostgresSession,
)
