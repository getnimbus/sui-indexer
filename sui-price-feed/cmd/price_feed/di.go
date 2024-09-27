//go:build wireinject
// +build wireinject

package main

import (
	"context"

	"sui-price-feed/internal/app/price_feed"

	"github.com/google/wire"
)

func initPriceFeedApp(ctx context.Context) (price_feed.App, func(), error) {
	wire.Build(price_feed.GraphSet)
	return nil, nil, nil
}
