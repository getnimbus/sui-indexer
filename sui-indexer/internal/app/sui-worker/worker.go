package sui_worker

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strconv"
	"sync"
	"time"

	"github.com/avast/retry-go/v4"
	sui_client "github.com/coming-chat/go-sui/v2/client"
	"github.com/coming-chat/go-sui/v2/types"
	"github.com/getnimbus/ultrago/u_logger"
	"github.com/hashicorp/golang-lru/v2/expirable"
	"github.com/samber/lo"
	"golang.org/x/sync/errgroup"
	"gorm.io/gorm"

	"feng-sui-core/internal/conf"
	"feng-sui-core/internal/entity"
	"feng-sui-core/internal/entity_dto/sui_model"
	"feng-sui-core/internal/infra"
	"feng-sui-core/internal/repo"
	"feng-sui-core/internal/service"
	"feng-sui-core/pkg/alert"
)

func NewWorker(
	kafkaProducer infra.KafkaSyncProducer,
	blockStatusRepo repo.BlockStatusRepo,
	baseSvc service.BaseService,
) (Worker, error) {
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

	return &worker{
		kafkaProducer:    kafkaProducer,
		blockStatusRepo:  blockStatusRepo,
		baseSvc:          baseSvc,
		suiIndexer:       service.NewSuiIndexer(client, fallbackClient),
		cache:            expirable.NewLRU[string, bool](500, nil, 50*time.Second),
		limitCheckpoints: 10, // maximum is 10
		numWorkers:       10,
		cooldown:         3 * time.Second,
		checkpointsTopic: conf.Config.SuiCheckpointsTopic,
		txsTopic:         conf.Config.SuiTxsTopic,
		eventsTopic:      conf.Config.SuiEventsTopic,
		indexTopic:       conf.Config.SuiIndexTopic,
	}, nil
}

type worker struct {
	kafkaProducer    infra.KafkaSyncProducer
	blockStatusRepo  repo.BlockStatusRepo
	baseSvc          service.BaseService
	suiIndexer       *service.SuiIndexer
	cache            *expirable.LRU[string, bool]
	limitCheckpoints int
	numWorkers       int
	cooldown         time.Duration
	checkpointsTopic string
	txsTopic         string
	eventsTopic      string
	indexTopic       string
}

type Worker interface {
	FetchTxs(ctx context.Context) error
}

func (w *worker) FetchTxs(ctx context.Context) error {
	ctx, logger := u_logger.GetLogger(ctx)
	logger.Info("start fetching txs...")

	eg, childCtx := errgroup.WithContext(ctx)
	for i := 0; i < w.numWorkers; i++ {
		eg.Go(func() error {
			for {
				select {
				case <-childCtx.Done():
					logger.Infof("stop fetching txs!")
					return nil
				default:
					w.fetchTxs(childCtx)
					time.Sleep(w.cooldown) // cooldown api
				}
			}
		})

		time.Sleep(1 * time.Second) // cooldown worker
	}

	return eg.Wait()
}

func (w *worker) fetchTxs(ctx context.Context) error {
	ctx, logger := u_logger.GetLogger(ctx)
	logger.Info("waiting query from db...")

	var blockStatuses []*entity.BlockStatus

	// recover panic
	defer func() {
		if re := recover(); re != nil {
			logger.Infof("panic: %v", re)
			// update status FAIL
			w.updateCheckpointStatus(ctx, entity.BlockStatus_FAIL, blockStatuses...)
			return
		}
	}()

	var dbErr = w.baseSvc.ExecTx(ctx, func(txCtx context.Context) error {
		scopes := []func(db *gorm.DB) *gorm.DB{
			w.blockStatusRepo.S().Locking(),
			w.blockStatusRepo.S().FilterStatuses(
				entity.BlockStatus_NOT_READY,
				entity.BlockStatus_FAIL,
			),
			w.blockStatusRepo.S().FilterType(entity.BlockStatusType_REALTIME),
			w.blockStatusRepo.S().ColumnEqual("chain", "SUI"),
			w.blockStatusRepo.S().Limit(w.limitCheckpoints),
			w.blockStatusRepo.S().SortBy("block_number", "ASC"),
		}

		var err error
		blockStatuses, err = w.blockStatusRepo.GetList(txCtx, scopes...)
		if err != nil {
			return err
		}

		// update block status PROCESSING
		return w.updateCheckpointStatus(txCtx, entity.BlockStatus_PROCESSING, blockStatuses...)
	})
	if dbErr != nil {
		logger.Errorf("failed to fetch block status from db: %v", dbErr)
		// update status FAIL
		w.updateCheckpointStatus(ctx, entity.BlockStatus_FAIL, blockStatuses...)
		return fmt.Errorf("failed to fetch block status from db: %v", dbErr)
	} else if len(blockStatuses) == 0 {
		logger.Warnf("not found any new blocks in db")
		return nil
	}

	var (
		checkpoints = make([]*sui_model.Checkpoint, 0)
		wg1         sync.WaitGroup
	)
	for _, b := range blockStatuses {
		blockStatus := b
		wg1.Add(1)

		go func() {
			defer wg1.Done()

			checkpoint, err := retry.DoWithData(
				func() (*sui_model.Checkpoint, error) {
					return w.suiIndexer.FetchCheckpoint(ctx, strconv.FormatInt(blockStatus.BlockNumber, 10))
				},
				// retry configs
				[]retry.Option{
					retry.Attempts(uint(5)),
					retry.OnRetry(func(n uint, err error) {
						logger.Errorf("Retry invoke function FetchCheckpoint %d to and get error: %v", n+1, err)
					}),
					retry.Delay(3 * time.Second),
					retry.Context(ctx),
				}...,
			)
			if err != nil {
				logger.Errorf("failed to fetch checkpoint from %v: %v", blockStatus.BlockNumber, err)
				// if node rpc has some errors so that it cannot return checkpoints => update status to failed
				// update status FAIL
				w.updateCheckpointStatus(ctx, entity.BlockStatus_FAIL, blockStatus)
				return
			}

			checkpoints = append(checkpoints, checkpoint)
		}()
	}

	// wait for all workers to finish
	wg1.Wait()

	if len(checkpoints) == 0 {
		logger.Warnf("no data checkpoints to process")
		w.updateCheckpointStatus(ctx, entity.BlockStatus_FAIL, blockStatuses...)
		return nil
	}
	var wg2 sync.WaitGroup
	for _, c := range checkpoints {
		checkpoint := c.WithDateKey()
		blockStatus, ok := lo.Find(blockStatuses, func(item *entity.BlockStatus) bool {
			return strconv.FormatInt(item.BlockNumber, 10) == checkpoint.SequenceNumber
		})
		if !ok {
			logger.Warnf("not found sequence number of checkpoint in block status")
			continue
		}
		if err := checkpoint.Validate(); err != nil {
			logger.Errorf("invalid checkpoint: %v", err)
			// update status FAIL
			w.updateCheckpointStatus(ctx, entity.BlockStatus_FAIL, blockStatus)
			continue
		}

		wg2.Add(1)
		go func() {
			defer wg2.Done()

			var fetchDataErr = func() error {
				uniqueTxs := lo.Uniq(checkpoint.Transactions)
				chunkTxDigests := lo.Chunk(uniqueTxs, 20)
				for _, txDigests := range chunkTxDigests {
					txs, err := retry.DoWithData(
						func() ([]*sui_model.Transaction, error) {
							return w.suiIndexer.FetchTxs(ctx, txDigests...)
						},
						// retry configs
						[]retry.Option{
							retry.Attempts(uint(5)),
							retry.OnRetry(func(n uint, err error) {
								logger.Errorf("Retry invoke function FetchTxs %d to and get error: %v", n+1, err)
							}),
							retry.Delay(3 * time.Second),
							retry.Context(ctx),
						}...,
					)
					if err != nil {
						if !errors.Is(err, context.Canceled) {
							alert.AlertDiscord(ctx, fmt.Sprintf("[sui-indexer] failed to fetch txs: %v", err))
						}
						return err
					}
					if err := checkpoint.SetBloomFilter(txs); err != nil {
						return err
					}

					var (
						parsedTxs    = make([]*sui_model.Transaction, 0)
						parsedEvents = make([]*sui_model.Event, 0)
						indices      = make([]*entity.SuiIndex, 0)
					)
					for _, tx := range txs {
						if err := tx.Validate(); err != nil {
							logger.Errorf("invalid tx: %v", err)
							return fmt.Errorf("invalid tx: %v", err)
						}
						parsedTxs = append(parsedTxs, tx.WithDateKey())

						// extract tx gasUsed for events
						gasUsed := tx.Effects["gasUsed"]
						for _, event := range tx.Events {
							if event.TimestampMs == nil || event.TimestampMs.Int64() == 0 {
								parsedTs, err := strconv.ParseUint(tx.TimestampMs, 10, 64)
								if err != nil {
									logger.Errorf("failed to parse timestamp: %v", err)
									return err
								}
								ts := types.NewSafeSuiBigInt[uint64](parsedTs)
								event.TimestampMs = &ts
							}
							parsedEvent := &sui_model.Event{
								SuiEvent: event,
							}

							// check in LRU cache if event is already processed
							eventKey := fmt.Sprintf("%v-%v-%v", checkpoint.SequenceNumber, tx.Digest, event.Id.EventSeq.Int64())
							_, ok := w.cache.Get(eventKey)
							if !ok {
								w.cache.Add(eventKey, true)

								parsedEvent = parsedEvent.
									WithDateKey().
									WithCheckpoint(checkpoint.SequenceNumber).
									WithGasUsed(gasUsed)
								parsedEvents = append(parsedEvents, parsedEvent)

								checkpointSeq, _ := strconv.ParseInt(checkpoint.SequenceNumber, 10, 64)
								suiIndex := &entity.SuiIndex{
									DateKey:          checkpoint.DateKey,
									CheckpointDigest: checkpoint.Digest,
									CheckpointSeq:    checkpointSeq,
									TxDigest:         tx.Digest,
									EventSeq:         event.Id.EventSeq.Int64(),
									PackageId:        event.PackageId.String(),
									EventType:        event.Type,
								}
								indices = append(indices, suiIndex)
							}
						}
					}

					eg, childCtx := errgroup.WithContext(ctx)
					// send txs to kafka
					eg.Go(func() error {
						for _, tx := range parsedTxs {
							if err := w.kafkaProducer.SendJson(childCtx, w.txsTopic, tx); err != nil {
								logger.Errorf("failed to send payload to kafka sui txs topic: %v", err)
								return err
							}
						}
						return nil
					})

					// send events to kafka
					eg.Go(func() error {
						for _, event := range parsedEvents {
							if err := w.kafkaProducer.SendJson(childCtx, w.eventsTopic, event); err != nil {
								logger.Errorf("failed to send payload to kafka sui events topic: %v", err)
								return err
							}
						}
						return nil
					})

					// send sui index to kafka
					eg.Go(func() error {
						for _, index := range indices {
							if err := w.kafkaProducer.SendJson(
								childCtx,
								w.indexTopic,
								index.ToKafka(),
							); err != nil {
								logger.Errorf("failed to send payload to kafka sui index topic: %v", err)
								return err
							}
						}
						return nil
					})

					// send checkpoints to kafka
					eg.Go(func() error {
						if checkpoint != nil {
							if err := w.kafkaProducer.SendJson(childCtx, w.checkpointsTopic, checkpoint); err != nil {
								logger.Errorf("failed to send payload to kafka sui checkpoints topic: %v", err)
								return err
							}
						}
						return nil
					})

					if err := eg.Wait(); err != nil {
						return err
					}
				}
				return nil
			}()
			if fetchDataErr != nil {
				logger.Errorf("failed to fetch txs: %v", fetchDataErr)
				// update status FAIL
				w.updateCheckpointStatus(ctx, entity.BlockStatus_FAIL, blockStatus)
				return
			}
			// update status DONE
			w.updateCheckpointStatus(ctx, entity.BlockStatus_DONE, blockStatus)
		}()
	}

	// wait for all workers to finish
	wg2.Wait()

	return nil
}

func (w *worker) updateCheckpointStatus(ctx context.Context, status int, checkpointIds ...*entity.BlockStatus) error {
	if len(checkpointIds) == 0 {
		return nil
	}
	if err := w.blockStatusRepo.UpdateStatus(ctx, status, lo.Map(checkpointIds, func(item *entity.BlockStatus, _ int) string {
		return item.ID
	})...); err != nil {
		return err
	}
	return nil
}
