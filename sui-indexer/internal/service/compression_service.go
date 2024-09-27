package service

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"github.com/getnimbus/ultrago/u_logger"
	"github.com/getnimbus/ultrago/u_monitor"
	drv "github.com/uber/athenadriver/go"
	"golang.org/x/sync/errgroup"

	"feng-sui-core/internal/conf"
)

func NewCompressionService() CompressionService {
	return &compressionService{
		athenaQueryResult:  conf.Config.AthenaQueryResult,
		awsRegion:          conf.Config.AwsRegion,
		awsAccessKeyId:     conf.Config.AwsAccessKeyId,
		awsSecretAccessKey: conf.Config.AwsSecretAccessKey,
	}
}

type CompressionService interface {
	CompressData(ctx context.Context, runningDate time.Time, autoAddPartitions bool) error
}

type compressionService struct {
	athenaQueryResult  string
	awsRegion          string
	awsAccessKeyId     string
	awsSecretAccessKey string
}

func (svc *compressionService) CompressData(ctx context.Context, runningDate time.Time, autoAddPartitions bool) error {
	ctx, logger := u_logger.GetLogger(ctx)

	defer u_monitor.TimeTrackWithCtx(ctx, time.Now())

	athenaConf, err := drv.NewDefaultConfig(
		svc.athenaQueryResult,
		svc.awsRegion,
		svc.awsAccessKeyId,
		svc.awsSecretAccessKey,
	)
	if err != nil {
		logger.Errorf("failed to create athena default config: %v", err)
		return fmt.Errorf("failed to create athena default config: %v", err)
	}

	dsn := athenaConf.Stringify()
	db, _ := sql.Open(drv.DriverName, dsn)
	defer db.Close()

	if autoAddPartitions {
		eg1, childCtx := errgroup.WithContext(ctx)
		// add partition of raw table first
		// table sui_checkpoints
		eg1.Go(func() error {
			rows, err := db.QueryContext(childCtx, "MSCK REPAIR TABLE raw_sui_checkpoints")
			if err != nil {
				logger.Errorf("failed to execute query: %v", err)
				return fmt.Errorf("failed to execute query: %v", err)
			}
			defer rows.Close()

			logger.Infof("Query result:\n%v", drv.ColsRowsToCSV(rows))
			return nil
		})

		// table sui_txs
		eg1.Go(func() error {
			rows, err := db.QueryContext(ctx, "MSCK REPAIR TABLE raw_sui_txs")
			if err != nil {
				logger.Errorf("failed to execute query: %v", err)
				return fmt.Errorf("failed to execute query: %v", err)
			}
			defer rows.Close()

			logger.Infof("Query result:\n%v", drv.ColsRowsToCSV(rows))
			return nil
		})
		if err := eg1.Wait(); err != nil {
			return err
		}
	}

	eg2, childCtx := errgroup.WithContext(ctx)
	// compress data in S3
	eg2.Go(func() error {
		rows, err := db.QueryContext(childCtx, fmt.Sprintf("INSERT INTO final_sui_checkpoints SELECT * FROM raw_sui_checkpoints WHERE datekey = '%s'", runningDate.Format(time.DateOnly)))
		if err != nil {
			logger.Errorf("failed to execute query: %v", err)
			return fmt.Errorf("failed to execute query: %v", err)
		}
		defer rows.Close()

		logger.Infof("Query result:\n%v", drv.ColsRowsToCSV(rows))
		return nil
	})

	eg2.Go(func() error {
		rows, err := db.QueryContext(childCtx, fmt.Sprintf("INSERT INTO final_sui_txs SELECT digest, timestampms, checkpoint, transaction, effects, events, objectchanges, balancechanges, DATE(datekey) FROM raw_sui_txs WHERE datekey = '%s'", runningDate.Format(time.DateOnly)))
		if err != nil {
			logger.Errorf("failed to execute query: %v", err)
			return fmt.Errorf("failed to execute query: %v", err)
		}
		defer rows.Close()

		logger.Infof("Query result:\n%v", drv.ColsRowsToCSV(rows))
		return nil
	})

	return eg2.Wait()
}
