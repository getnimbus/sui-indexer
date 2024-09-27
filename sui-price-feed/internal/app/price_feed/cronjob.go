package price_feed

import (
	"context"
	"fmt"
	"time"

	"github.com/getnimbus/ultrago/u_logger"
	"github.com/go-co-op/gocron/v2"
	"github.com/google/uuid"
	"github.com/gtuk/discordwebhook"

	"sui-price-feed/internal/conf"
	"sui-price-feed/internal/service"
)

func NewCronjob(
	priceFeedService service.PriceFeedService,
) Cronjob {
	return &cronjob{
		priceFeedService: priceFeedService,
	}
}

type cronjob struct {
	priceFeedService service.PriceFeedService
}

type Cronjob interface {
	Start(ctx context.Context) error
}

func (c *cronjob) Start(ctx context.Context) error {
	ctx, logger := u_logger.GetLogger(ctx)

	s, err := gocron.NewScheduler(gocron.WithLocation(time.UTC))
	if err != nil {
		logger.Errorf("failed to create new scheduler: %v", err)
		return fmt.Errorf("failed to create new scheduler: %v", err)
	}
	defer func() { _ = s.Shutdown() }()

	// periodically update price feed every 5 mins
	j1, err := s.NewJob(
		gocron.CronJob(
			"*/5 * * * *",
			false,
		),
		gocron.NewTask(
			func() {
				logger.Infof("start to get price feed...")
				if err := c.priceFeedService.GetPriceFeed(ctx); err != nil {
					logger.Errorf("failed to get price feed: %v", err)
					return
				}
				logger.Infof("successfully get price feed!")
			},
		),
		gocron.WithName("get_price_feed"),
		gocron.WithSingletonMode(gocron.LimitModeReschedule),
		gocron.WithEventListeners(
			gocron.AfterJobRuns(
				func(jobID uuid.UUID, jobName string) {
					logger.Infof("job %s with id %s finished", jobName, jobID)
				},
			),
			gocron.AfterJobRunsWithError(
				func(jobID uuid.UUID, jobName string, err error) {
					errMes := fmt.Sprintf("[sui-price-feed] job %s with id %s failed: %v", jobName, jobID, err)
					logger.Errorf(errMes)

					if conf.Config.DiscordWebhook != "" {
						message := discordwebhook.Message{
							Content: &errMes,
						}
						if err := discordwebhook.SendMessage(conf.Config.DiscordWebhook, message); err != nil {
							logger.Errorf("failed to send message to discord: %v", err)
						}
					}
				},
			),
		),
	)
	if err != nil {
		logger.Errorf("failed to registered job %s: %v", j1.Name(), err)
		return fmt.Errorf("failed to registered job %s: %v", j1.Name(), err)
	}

	s.Start() // non-blocking
	logger.Infof("start cronjob scheduler...")

	timer := time.After(5 * time.Minute)
	for {
		select {
		case <-ctx.Done():
			logger.Infof("stopped cronjob scheduler!")
			return nil
		case <-timer:
			j1LastRun, _ := j1.LastRun()
			j1NextRun, _ := j1.NextRun()
			logger.Infof("job %s last run: %s, next run: %s", j1.Name(), j1LastRun, j1NextRun)
		}
	}
}
