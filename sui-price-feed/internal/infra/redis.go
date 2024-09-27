package infra

import (
	"context"
	"time"

	"github.com/getnimbus/ultrago/u_logger"
	goredis "github.com/redis/go-redis/v9"

	"sui-price-feed/internal/conf"
)

type RedisClient struct {
	*goredis.Client
}

func NewRedisClient() (*RedisClient, func(), error) {
	logger := u_logger.NewLogger()

	c := goredis.NewClient(&goredis.Options{
		Addr:         conf.Config.RedisAddress,
		Password:     conf.Config.RedisPassword,
		DB:           conf.Config.RedisDB,
		WriteTimeout: time.Second * 60,
		ReadTimeout:  time.Second * 60,
	})

	// check redis connection
	_, err := c.Ping(context.Background()).Result()
	if err != nil {
		logger.Errorf("error creating redis client: %s", err.Error())
		return nil, nil, err
	}
	logger.Infof("redis client connected")

	cleanup := func() {
		logger.Infof("closing redis client")
		if err := c.Close(); err != nil {
			logger.Error(err)
		}
	}

	return &RedisClient{c}, cleanup, nil
}
