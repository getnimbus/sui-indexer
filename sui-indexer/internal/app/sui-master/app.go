package sui_master

import (
	"context"
	"fmt"
	"time"

	"github.com/getnimbus/ultrago/u_logger"
	"github.com/getnimbus/ultrago/u_monitor"
	"golang.org/x/sync/errgroup"

	"feng-sui-core/internal/service"
)

func NewApp(
	cronjob Cronjob,
	master Master,
	compressionSvc service.CompressionService,
) App {
	return &app{
		cronjob:        cronjob,
		master:         master,
		compressionSvc: compressionSvc,
	}
}

type App interface {
	Start(ctx context.Context) error
	Stop(ctx context.Context) error
}

type app struct {
	cronjob        Cronjob
	master         Master
	compressionSvc service.CompressionService
}

func (a *app) Start(ctx context.Context) error {
	ctx, logger := u_logger.GetLogger(ctx)

	// for monitoring memory
	go u_monitor.Monitor(ctx, 30*time.Second)

	// TODO: only for manual snapshot checkpoint
	//if err := a.master.SnapshotCheckpoint(ctx, 0, 26641529); err != nil {
	//	logger.Errorf("failed to snapshot checkpoint: %v", err)
	//	return fmt.Errorf("failed to snapshot checkpoint: %v", err)
	//}
	//return nil

	// TODO: test compress data in S3
	//if err := a.compressionSvc.CompressData(
	//	ctx,
	//	time.Date(2024, 3, 9, 0, 0, 0, 0, time.Local),
	//	false,
	//); err != nil {
	//	logger.Errorf("failed to compress data: %v", err)
	//	return fmt.Errorf("failed to compress data: %v", err)
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

	// fetch latest checkpoint periodically
	eg.Go(func() error {
		if err := a.master.FetchCheckpoint(childCtx); err != nil {
			logger.Errorf("failed to fetch checkpoint: %v", err)
			return fmt.Errorf("failed to fetch checkpoint: %v", err)
		}
		return nil
	})

	logger.Info("master started!")
	return eg.Wait()
}

func (a *app) Stop(ctx context.Context) error {
	ctx, logger := u_logger.GetLogger(ctx)
	logger.Infof("master stopped!")
	return nil
}
