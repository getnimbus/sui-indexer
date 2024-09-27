package sui_worker

import (
	"github.com/getnimbus/ultrago/u_http_client"
	"github.com/google/wire"

	"feng-sui-core/internal/infra"
	"feng-sui-core/internal/repo/gorm"
	"feng-sui-core/internal/repo/gorm_scope"
	"feng-sui-core/internal/service"
)

var deps = wire.NewSet(
	u_http_client.NewHttpExecutor,
	infra.GraphSet,
	infra.NewKafkaSyncProducer,
	gorm_scope.GraphSet,
	gorm.GraphSet,
	service.GraphSet,
)

var GraphSet = wire.NewSet(
	deps,
	NewWorker,
	NewApp,
)
