package sui_master

import (
	"context"
	"fmt"
	"net/http"
	"net/url"
	"strconv"
	"time"

	sui_client "github.com/coming-chat/go-sui/v2/client"
	"github.com/getnimbus/ultrago/u_logger"
	"github.com/samber/lo"
	"golang.org/x/sync/errgroup"

	"feng-sui-core/internal/conf"
	"feng-sui-core/internal/entity"
	"feng-sui-core/internal/repo"
	"feng-sui-core/internal/service"
	"feng-sui-core/pkg/alert"
)

func NewMaster(
	blockStatusRepo repo.BlockStatusRepo,
) (Master, error) {
	var transport *http.Transport
	if conf.Config.IsUseProxy() {
		proxyUrl, err := url.Parse(conf.Config.HttpProxy)
		if err != nil {
			return nil, err
		}
		transport = &http.Transport{Proxy: http.ProxyURL(proxyUrl)}
	} else {
		transport = http.DefaultTransport.(*http.Transport)
	}

	client, err := sui_client.DialWithClient(conf.Config.SuiRpc, &http.Client{
		Transport: transport.Clone(),
		Timeout:   2 * 60 * time.Second, // 2 mins
	})
	if err != nil {
		return nil, err
	}
	fallbackClient, _ := sui_client.DialWithClient(conf.Config.FallbackSuiRpc, &http.Client{
		Transport: transport.Clone(),
		Timeout:   2 * 60 * time.Second, // 2 mins
	})

	return &master{
		blockStatusRepo: blockStatusRepo,
		suiIndexer:      service.NewSuiIndexer(client, fallbackClient),
		cooldown:        5 * time.Second,
		numWorkers:      5,
	}, nil
}

type master struct {
	blockStatusRepo repo.BlockStatusRepo
	suiIndexer      *service.SuiIndexer
	cooldown        time.Duration
	numWorkers      int
}

type Master interface {
	FetchCheckpoint(ctx context.Context) error
	SnapshotCheckpoint(ctx context.Context, from int64, to int64) error
	Monitor(ctx context.Context) error
}

func (m *master) FetchCheckpoint(ctx context.Context) error {
	ctx, logger := u_logger.GetLogger(ctx)

	for {
		select {
		case <-ctx.Done():
			logger.Infof("stop fetching checkpoint!")
			return nil
		default:
			if err := m.fetchCheckpoint(ctx); err != nil {
				logger.Errorf("failed to fetch checkpoint: %v", err)
			}
			time.Sleep(m.cooldown)
		}
	}
}

func (m *master) SnapshotCheckpoint(ctx context.Context, from int64, to int64) error {
	ctx, logger := u_logger.GetLogger(ctx)

	var blocks = make([]*entity.BlockStatus, 0)
	for i := to; i >= from; i-- {
		blocks = append(blocks, &entity.BlockStatus{
			Chain:       "SUI",
			BlockNumber: i,
			Status:      entity.BlockStatus_NOT_READY,
			Type:        entity.BlockStatusType_BACKFILL,
		})
	}
	if len(blocks) == 0 {
		return nil
	}

	eg, childCtx := errgroup.WithContext(ctx)
	eg.SetLimit(m.numWorkers)

	chunks := lo.Chunk(blocks, 1000)
	for _, c := range chunks {
		chunk := c
		eg.Go(func() error {
			if err := m.blockStatusRepo.CreateMany(childCtx, chunk...); err != nil {
				logger.Errorf("failed to snapshot checkpoints: %v", err)
				for _, item := range chunk {
					_ = m.blockStatusRepo.Save(childCtx, item)
				}
			}
			return nil
		})
	}
	return eg.Wait()
}

func (m *master) fetchCheckpoint(ctx context.Context) error {
	ctx, logger := u_logger.GetLogger(ctx)
	logger.Infof("start fetch checkpoint...")

	latestCheckpointSeq, err := m.getLatestCheckpoint(ctx)
	if err != nil {
		return err
	}

	var savedCheckpointSeq int64
	savedCheckpoints, err := m.blockStatusRepo.GetList(ctx,
		m.blockStatusRepo.S().ColumnEqual("chain", "SUI"),
		m.blockStatusRepo.S().SortBy("block_number", "DESC"),
		m.blockStatusRepo.S().FilterType(entity.BlockStatusType_REALTIME),
		m.blockStatusRepo.S().LimitOffset(1, 0),
	)
	if err != nil {
		return err
	}

	if len(savedCheckpoints) == 0 {
		savedCheckpointSeq = 0
	} else {
		savedCheckpointSeq = savedCheckpoints[0].BlockNumber
	}

	var blocks = make([]*entity.BlockStatus, 0)
	// we delay 10 blocks from latest checkpoint
	for i := savedCheckpointSeq + 1; i <= latestCheckpointSeq-10; i++ {
		blocks = append(blocks, &entity.BlockStatus{
			Chain:       "SUI",
			BlockNumber: i,
			Status:      entity.BlockStatus_NOT_READY,
			Type:        entity.BlockStatusType_REALTIME,
		})
	}
	if len(blocks) == 0 {
		return nil
	}

	eg, childCtx := errgroup.WithContext(ctx)
	eg.SetLimit(m.numWorkers)

	chunks := lo.Chunk(blocks, 1000)
	for _, c := range chunks {
		chunk := c
		eg.Go(func() error {
			if err := m.blockStatusRepo.CreateMany(childCtx, chunk...); err != nil {
				logger.Errorf("failed to save checkpoints: %v", err)
				for _, item := range chunk {
					_ = m.blockStatusRepo.Save(childCtx, item)
				}
			}
			return nil
		})
	}
	return eg.Wait()
}

func (m *master) Monitor(ctx context.Context) error {
	ctx, logger := u_logger.GetLogger(ctx)

	latestCheckpointSeq, err := m.getLatestCheckpoint(ctx)
	if err != nil {
		logger.Errorf("failed to get latest checkpoint: %v", err)
		return err
	}

	currentBlock, err := m.blockStatusRepo.GetCurrentBlock(ctx)
	if err != nil {
		logger.Errorf("failed to current block: %v", err)
		return err
	}

	delayBlocks := latestCheckpointSeq - currentBlock
	var message = fmt.Sprintf("SUI - %v/%v. Delay %v blocks", currentBlock, latestCheckpointSeq, delayBlocks)
	logger.Info(message)
	alert.AlertDiscord(ctx, message)

	return nil
}

func (m *master) getLatestCheckpoint(ctx context.Context) (int64, error) {
	latestCheckpoint, err := m.suiIndexer.FetchLatestCheckpoint(ctx)
	if err != nil {
		return 0, err
	}
	return strconv.ParseInt(latestCheckpoint, 10, 64)
}
