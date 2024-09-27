package service

import (
	"context"
	"fmt"
	"time"

	"github.com/avast/retry-go/v4"
	"github.com/getnimbus/ultrago/u_logger"
	"github.com/golang-module/carbon/v2"
	"golang.org/x/sync/errgroup"
	"gorm.io/gorm"

	"sui-price-feed/internal/conf"
	"sui-price-feed/internal/entity"
	"sui-price-feed/internal/infra"
	"sui-price-feed/internal/repo"
)

func NewPriceFeedService(
	kafkaProducer infra.KafkaSyncProducer,
	db *gorm.DB,
	priceFeedRepo repo.PriceFeedRepo,
	suiIndexer *SuiIndexer,
) PriceFeedService {
	return &priceFeedService{
		kafkaProducer: kafkaProducer,
		db:            db,
		priceFeedRepo: priceFeedRepo,
		suiIndexer:    suiIndexer,
	}
}

type PriceFeedService interface {
	GetPriceFeed(ctx context.Context) error
}

type priceFeedService struct {
	kafkaProducer infra.KafkaSyncProducer
	db            *gorm.DB
	priceFeedRepo repo.PriceFeedRepo
	suiIndexer    *SuiIndexer
}

func (svc *priceFeedService) GetPriceFeed(ctx context.Context) error {
	ctx, logger := u_logger.GetLogger(ctx)

	// fetch latest checkpoint
	checkpoint, err := retry.DoWithData(
		func() (int64, error) {
			return svc.suiIndexer.FetchLatestCheckpoint(ctx)
		},
		// retry configs
		[]retry.Option{
			retry.Attempts(uint(5)),
			retry.OnRetry(func(n uint, err error) {
				logger.Errorf("Retry invoke function %d to and get error: %v", n+1, err)
			}),
			retry.Delay(3 * time.Second),
			retry.Context(ctx),
		}...,
	)
	if err != nil {
		logger.Errorf("failed to fetch latest checkpoint: %v", err)
		return fmt.Errorf("failed to fetch latest checkpoint: %v", err)
	}

	var (
		prices  []*entity.PriceFeed
		current = carbon.Now(carbon.UTC).StartOfMinute().TimestampMilli()
	)
	query := `WITH token_swap AS ( 			
	SELECT
		block,
		from_token_address,
		to_token_address,
		amount_usd/quanlity_in AS from_price,
		amount_usd/quanlity_out AS to_price,
		timestamp
	FROM trade
	WHERE chain = 'SUI'
	AND amount_usd > 0
	AND quanlity_out > 0
	AND block BETWEEN ? AND ?
	ORDER BY block DESC
),
token_price AS (
	SELECT
		from_token_address AS token_address,
		from_price AS price
	FROM token_swap
	UNION ALL
	SELECT
		to_token_address AS token_address,
		to_price AS price
	FROM token_swap
)
SELECT
	t2.token_address,
	t2.token_name,
	t2.token_symbol,
	t2.token_decimals,
	t2.chain,
	AVG(t1.price) AS price
FROM token_price t1
LEFT JOIN tokens t2 ON t1.token_address = t2.token_address AND t2.chain = 'SUI'
GROUP BY 1,2,3,4,5;
`
	if err := svc.db.WithContext(ctx).Raw(
		query, checkpoint-300, checkpoint, // query checkpoints from last 5 mins
	).Scan(&prices).Error; err != nil {
		logger.Errorf("failed to get price feed: %v", err)
		return fmt.Errorf("failed to get price feed: %v", err)
	}

	eg, childCtx := errgroup.WithContext(ctx)
	for _, p := range prices {
		price := p
		price.Timestamp = current

		// send price feed to kafka
		eg.Go(func() error {
			if err := svc.kafkaProducer.SendJson(childCtx, conf.Config.SuiPriceFeedTopic, price); err != nil {
				logger.Errorf("failed to send price feed to kafka: %v", err)
			}
			return nil
		})

		// create price feed to postgres db
		eg.Go(func() error {
			if err := svc.priceFeedRepo.Create(childCtx, price); err != nil {
				logger.Errorf("failed to create price feed: %v", err)
			}
			return nil
		})
	}
	return eg.Wait()
}
