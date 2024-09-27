package redis

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/getnimbus/ultrago/u_logger"
	"github.com/redis/go-redis/v9"
	"github.com/samber/lo"

	"sui-price-feed/internal/infra"
	"sui-price-feed/internal/repo"
)

func NewRedisRepo(
	rd *infra.RedisClient,
	prefix string,
	expiration time.Duration,
) repo.RedisRepo {
	return &redisRepo{
		prefix:     prefix,
		expiration: expiration,
		rd:         rd,
	}
}

type redisRepo struct {
	prefix     string
	expiration time.Duration
	rd         *infra.RedisClient
}

func (repo *redisRepo) Set(ctx context.Context, key string, value interface{}) error {
	redisKey := repo.redisKey(key)
	redisValue, err := repo.redisValue(value)
	var cmd *redis.StatusCmd
	if err != nil {
		cmd = repo.rd.Set(ctx, redisKey, value, repo.expiration)
	} else {
		cmd = repo.rd.Set(ctx, redisKey, redisValue, repo.expiration)
	}
	return cmd.Err()
}

func (repo *redisRepo) Get(ctx context.Context, key string) (string, error) {
	redisKey := repo.redisKey(key)
	return repo.rd.Get(ctx, redisKey).Result()
}

// MSet sets multiple key values
// No expiration time specified
// Should refresh cache by manual
func (repo *redisRepo) MSet(ctx context.Context, values map[string]interface{}, bulkSize int) error {
	return repo.rd.Watch(ctx, func(tx *redis.Tx) error {
		_, err := tx.TxPipelined(ctx, func(pipe redis.Pipeliner) error {
			pairs := make([]interface{}, 0, bulkSize)
			for key, value := range values {
				redisKey := repo.redisKey(key)
				pairs = append(pairs, redisKey, value)
				if len(pairs) == bulkSize {
					if err := pipe.MSet(ctx, pairs...).Err(); err != nil {
						return err
					}
					pairs = make([]interface{}, 0, bulkSize)
				}
			}
			// flush all remain to redis
			if len(pairs) > 0 {
				if err := pipe.MSet(ctx, pairs...).Err(); err != nil {
					return err
				}
			}
			return nil
		})
		return err
	})
}

// MGet get multiple value
func (repo *redisRepo) MGet(ctx context.Context, keys []string) ([]interface{}, error) {
	redisKeys := lo.Map(keys, func(key string, _ int) string {
		return repo.redisKey(key)
	})
	return repo.rd.MGet(ctx, redisKeys...).Result()
}

func (repo *redisRepo) HSet(ctx context.Context, key string, values map[string]interface{}) error {
	redisKey := repo.redisKey(key)
	return repo.rd.HSet(ctx, redisKey, values).Err()
}

func (repo *redisRepo) HGet(ctx context.Context, key string, field string) (string, error) {
	redisKey := repo.redisKey(key)
	return repo.rd.HGet(ctx, redisKey, field).Result()
}

func (repo *redisRepo) HMSet(ctx context.Context, hashKey string, values map[string]interface{}, bulkSize int) error {
	return repo.rd.Watch(ctx, func(tx *redis.Tx) error {
		_, err := tx.TxPipelined(ctx, func(pipe redis.Pipeliner) error {
			redisKey := repo.redisKey(hashKey)
			pairs := make([]interface{}, 0, bulkSize)
			for key, value := range values {
				pairs = append(pairs, key, value)
				if len(pairs) == bulkSize {
					if err := pipe.HMSet(ctx, redisKey, pairs).Err(); err != nil {
						return err
					}
					pairs = nil
				}
			}
			// flush all remain to redis
			if len(pairs) > 0 {
				if err := pipe.HMSet(ctx, redisKey, pairs).Err(); err != nil {
					return err
				}
			}
			return nil
		})
		return err
	})
}

func (repo *redisRepo) HGetAll(ctx context.Context, key string) (map[string]string, error) {
	redisKey := repo.redisKey(key)
	return repo.rd.HGetAll(ctx, redisKey).Result()
}

func (repo *redisRepo) Invalidate(ctx context.Context, key string) error {
	redisKey := repo.redisKey(key)
	return repo.rd.Del(ctx, redisKey).Err()
}

func (repo *redisRepo) InvalidatePrefix(ctx context.Context, prefix string) error {
	if prefix == "" {
		prefix = repo.prefix
	}
	iter := repo.rd.Scan(ctx, 0, fmt.Sprintf("nimbus-enhance-api:%s:%s", prefix, "*"), 0).Iterator()
	for iter.Next(ctx) {
		if err := repo.rd.Del(ctx, iter.Val()).Err(); err != nil {
			return err
		}
	}
	if err := iter.Err(); err != nil {
		return err
	}
	return nil
}

func (repo *redisRepo) FlushDB(ctx context.Context) error {
	return repo.rd.FlushDBAsync(ctx).Err()
}

func (repo *redisRepo) Expire(ctx context.Context, key string, duration time.Duration) error {
	redisKey := repo.redisKey(key)
	cmd := repo.rd.Expire(ctx, redisKey, duration)
	return cmd.Err()
}

func (repo *redisRepo) GetTTL(ctx context.Context, key string) (time.Duration, error) {
	redisKey := repo.redisKey(key)
	cmd := repo.rd.TTL(ctx, redisKey)
	return cmd.Result()
}

func (repo *redisRepo) Exist(ctx context.Context, key string) bool {
	redisKey := repo.redisKey(key)
	res, err := repo.rd.Exists(ctx, redisKey).Result()
	if err != nil {
		return false
	} else {
		return res == 1
	}
}

func (repo *redisRepo) Close(ctx context.Context) error {
	return repo.rd.Close()
}

func (repo *redisRepo) redisKey(key string) string {
	if repo.prefix != "" {
		return fmt.Sprintf("%s:%s", repo.prefix, key)
	}
	return fmt.Sprintf(key)
}

func (repo *redisRepo) redisValue(value interface{}) (string, error) {
	logger := u_logger.NewLogger()
	data, err := json.Marshal(value)
	if err != nil {
		logger.Errorf("failed to redis value to json: %s", err.Error())
		return "", err
	}
	return string(data), nil
}
