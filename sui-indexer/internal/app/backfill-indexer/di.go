package backfill_indexer

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
	infra.NewAwsSession,
	gorm_scope.GraphSet,
	gorm.GraphSet,
	service.GraphSet,
	service.NewS3Service,
)

var GraphSet = wire.NewSet(
	deps,
	NewWorker,
	NewApp,
)
