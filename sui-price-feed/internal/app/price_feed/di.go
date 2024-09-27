package price_feed

import (
	"github.com/getnimbus/ultrago/u_http_client"
	"github.com/google/wire"

	"sui-price-feed/internal/infra"
	"sui-price-feed/internal/repo/gorm"
	"sui-price-feed/internal/repo/gorm_scope"
	"sui-price-feed/internal/service"
)

var deps = wire.NewSet(
	u_http_client.NewHttpExecutor,
	infra.NewKafkaSyncProducer,
	infra.GraphSet,
	gorm_scope.GraphSet,
	gorm.GraphSet,
	service.GraphSet,
)

var GraphSet = wire.NewSet(
	deps,
	NewCronjob,
	NewApp,
)
