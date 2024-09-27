package sui_worker

import (
	"context"
	"time"

	"github.com/getnimbus/ultrago/u_logger"
	"github.com/getnimbus/ultrago/u_monitor"
	"golang.org/x/sync/errgroup"
)

func NewApp(
	worker Worker,
) App {
	return &app{
		worker: worker,
	}
}

type App interface {
	Start(ctx context.Context) error
	Stop(ctx context.Context) error
}

type app struct {
	worker Worker
}

func (a *app) Start(ctx context.Context) error {
	ctx, logger := u_logger.GetLogger(ctx)

	// for monitoring memory
	go u_monitor.Monitor(ctx, 30*time.Second)

	eg, childCtx := errgroup.WithContext(ctx)

	// start kafka consumer
	eg.Go(func() error {
		logger.Info("start fetch txs...")

		if err := a.worker.FetchTxs(childCtx); err != nil {
			logger.Errorf("failed to fetch txs: %v", err)
			return err
		}
		return nil
	})

	logger.Info("worker started!")
	return eg.Wait()
}

func (a *app) Stop(ctx context.Context) error {
	ctx, logger := u_logger.GetLogger(ctx)
	logger.Infof("worker stopped!")
	return nil
}
