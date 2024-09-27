//go:build wireinject
// +build wireinject

package main

import (
	"context"

	"github.com/google/wire"

	"feng-sui-core/internal/app/cli"
)

func initCLI(ctx context.Context) (cli.App, func(), error) {
	wire.Build(cli.GraphSet)
	return nil, nil, nil
}
