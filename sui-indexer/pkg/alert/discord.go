package alert

import (
	"context"
	"time"

	"github.com/getnimbus/ultrago/u_logger"
	"github.com/gtuk/discordwebhook"
	"github.com/yudppp/throttle"

	"feng-sui-core/internal/conf"
)

var throttler = throttle.New(3 * time.Second)

func AlertDiscord(ctx context.Context, message string) {
	ctx, logger := u_logger.GetLogger(ctx)

	throttler.Do(func() {
		if conf.Config.DiscordWebhook != "" {
			message := discordwebhook.Message{
				Content: &message,
			}
			if err := discordwebhook.SendMessage(conf.Config.DiscordWebhook, message); err != nil {
				logger.Warnf("failed to send message to discord: %v", err)
				return
			}
		}
	})
}
