//go:build wireinject
// +build wireinject

package main

import (
	"context"

	"github.com/google/wire"

	"feng-sui-core/internal/app/sui-master"
)

func initSuiMasterApp(ctx context.Context) (sui_master.App, func(), error) {
	wire.Build(sui_master.GraphSet)
	return nil, nil, nil
}
