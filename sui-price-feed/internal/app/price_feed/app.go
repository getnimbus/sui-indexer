package price_feed

import (
	"context"
	"fmt"
	"time"

	"github.com/getnimbus/ultrago/u_logger"
	"github.com/getnimbus/ultrago/u_monitor"
	"golang.org/x/sync/errgroup"

	"sui-price-feed/internal/service"
)

func NewApp(
	cronjob Cronjob,
	priceFeedService service.PriceFeedService,
) App {
	return &app{
		cronjob:          cronjob,
		priceFeedService: priceFeedService,
	}
}

type App interface {
	Start(ctx context.Context) error
	Stop(ctx context.Context) error
}

type app struct {
	cronjob          Cronjob
	priceFeedService service.PriceFeedService
}

func (a *app) Start(ctx context.Context) error {
	ctx, logger := u_logger.GetLogger(ctx)

	// for monitoring memory
	go u_monitor.Monitor(ctx, 30*time.Second)

	// TODO: testing only
	//if err := a.priceFeedService.GetPriceFeed(ctx); err != nil {
	//	logger.Errorf("failed to get price feed: %v", err)
	//	return fmt.Errorf("failed to get price feed: %v", err)
	//}
	//return nil

	eg, childCtx := errgroup.WithContext(ctx)

	// start cronjob for update failed block status
	eg.Go(func() error {
		if err := a.cronjob.Start(childCtx); err != nil {
			logger.Errorf("failed to start cronjob: %v", err)
			return fmt.Errorf("failed to start cronjob: %v", err)
		}
		return nil
	})

	logger.Info("price feed started!")
	return eg.Wait()
}

func (a *app) Stop(ctx context.Context) error {
	ctx, logger := u_logger.GetLogger(ctx)
	logger.Infof("price feed stopped!")
	return nil
}
