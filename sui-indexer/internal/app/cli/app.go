package cli

import (
	"context"
	"fmt"
	"time"

	"github.com/getnimbus/ultrago/u_logger"
	"github.com/getnimbus/ultrago/u_monitor"
	"github.com/golang-module/carbon/v2"
	"golang.org/x/sync/errgroup"

	"feng-sui-core/internal/service"
)

func NewApp(
	syncTradeSvc service.SyncTradeService,
	compressionSvc service.CompressionService,
) App {
	return &app{
		syncTradeSvc:   syncTradeSvc,
		compressionSvc: compressionSvc,
	}
}

type App interface {
	SyncTrades(ctx context.Context, rawParams ...string) error
	CompressData(ctx context.Context, rawParams ...string) error
}

type app struct {
	syncTradeSvc   service.SyncTradeService
	compressionSvc service.CompressionService
}

func (a *app) SyncTrades(ctx context.Context, rawParams ...string) error {
	ctx, logger := u_logger.GetLogger(ctx)

	defer u_monitor.TimeTrackWithCtx(ctx, time.Now())

	params, err := a.prepareParams(2, rawParams...)
	if err != nil {
		return err
	}

	switch params[0] {
	case "local":
		if err := a.syncTradeSvc.SyncTradesFromCsv(ctx, params[1]); err != nil {
			logger.Errorf("sync trades from csv failed: %v", err)
			return err
		}
		return nil
	case "s3":
		if err := a.syncTradeSvc.SyncTradesFromS3(ctx, params[1]); err != nil {
			logger.Errorf("sync trades from s3 failed: %v", err)
			return err
		}
		return nil
	default:
		logger.Infof("not supported flag")
		return nil
	}
}

func (a *app) CompressData(ctx context.Context, rawParams ...string) error {
	ctx, logger := u_logger.GetLogger(ctx)

	defer u_monitor.TimeTrackWithCtx(ctx, time.Now())

	params, err := a.prepareParams(1, rawParams...)
	if err != nil {
		return err
	}

	if len(params) == 1 { // compress data for a specific date
		runningDate := carbon.Parse(params[0], carbon.UTC)
		logger.Infof("compressing data for date: %s", runningDate.ToDateString())
		if err := a.compressionSvc.CompressData(ctx, runningDate.ToStdTime(), false); err != nil {
			logger.Errorf("compress data failed: %v", err)
			return err
		}
	} else if len(params) == 2 { // compress data for a range of dates
		var (
			fromDate          = carbon.Parse(params[0], carbon.UTC)
			toDate            = carbon.Parse(params[1], carbon.UTC)
			duration          = fromDate.DiffAbsInDays(toDate)
			autoAddPartitions = true
		)

		eg, childCtx := errgroup.WithContext(ctx)
		eg.SetLimit(3) // limit the number of concurrent goroutines

		for i := 0; i < int(duration); i++ {
			runningDate := fromDate.AddDays(i)

			eg.Go(func() error {
				logger.Infof("compressing data for date: %s", runningDate.ToDateString())
				if i != 0 && autoAddPartitions == true {
					autoAddPartitions = false
				}
				if err := a.compressionSvc.CompressData(childCtx, runningDate.ToStdTime(), autoAddPartitions); err != nil {
					logger.Errorf("compress data failed: %v", err)
					return err
				}
				return nil
			})
		}

		if err := eg.Wait(); err != nil {
			return err
		}
	}

	return nil
}

func (a *app) prepareParams(requires int, params ...string) ([]string, error) {
	var results = make([]string, 0, len(params))
	for idx, param := range params {
		if idx < requires && param == "" {
			return nil, fmt.Errorf("param%d is missing", idx+1)
		}
		if param != "" {
			results = append(results, param)
		}
	}
	return results, nil
}
