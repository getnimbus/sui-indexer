package repo

import (
	"context"
	"time"
)

type RedisRepo interface {
	Set(ctx context.Context, key string, value interface{}) error
	Get(ctx context.Context, key string) (string, error)
	MSet(ctx context.Context, values map[string]interface{}, bulkSize int) error
	MGet(ctx context.Context, keys []string) ([]interface{}, error)
	HSet(ctx context.Context, key string, values map[string]interface{}) error
	HGet(ctx context.Context, key string, field string) (string, error)
	HMSet(ctx context.Context, hashKey string, values map[string]interface{}, bulkSize int) error
	HGetAll(ctx context.Context, key string) (map[string]string, error)
	Invalidate(ctx context.Context, key string) error
	InvalidatePrefix(ctx context.Context, prefix string) error
	FlushDB(ctx context.Context) error
	Expire(ctx context.Context, key string, duration time.Duration) error
	GetTTL(ctx context.Context, key string) (time.Duration, error)
	Exist(ctx context.Context, key string) bool
	Close(ctx context.Context) error
}
