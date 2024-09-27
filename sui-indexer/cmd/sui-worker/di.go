//go:build wireinject
// +build wireinject

package main

import (
	"context"

	"github.com/google/wire"

	"feng-sui-core/internal/app/sui-worker"
)

func initSuiWorkerApp(ctx context.Context) (sui_worker.App, func(), error) {
	wire.Build(sui_worker.GraphSet)
	return nil, nil, nil
}
