package retry

import (
	"context"
	"time"

	"github.com/cenkalti/backoff/v4"
	"github.com/getnimbus/ultrago/u_logger"
)

func BackoffRetryWithContext(ctx context.Context, operation func() error) error {
	ctx, logger := u_logger.GetLogger(ctx)

	bo := backoff.NewExponentialBackOff()
	bo.MaxElapsedTime = 1 * time.Hour
	bCtx := backoff.WithContext(bo, ctx)

	// logger.Info("calling backoff retry")
	err := backoff.Retry(operation, bCtx)
	if err != nil {
		logger.Errorf("error retry")
		logger.Error(err)
		return err
	}
	// logger.Info("operation is finished")
	return nil
}
