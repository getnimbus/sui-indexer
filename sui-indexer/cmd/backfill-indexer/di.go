//go:build wireinject
// +build wireinject

package main

import (
	"context"

	"github.com/google/wire"

	backfill_indexer "feng-sui-core/internal/app/backfill-indexer"
)

func initBackfillIndexerApp(ctx context.Context) (backfill_indexer.App, func(), error) {
	wire.Build(backfill_indexer.GraphSet)
	return nil, nil, nil
}
