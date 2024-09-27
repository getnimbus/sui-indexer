package caching

import (
	"fmt"
	"time"

	"github.com/kofalt/go-memoize"
	"github.com/mitchellh/hashstructure/v2"

	"feng-sui-core/internal/conf"
	"feng-sui-core/pkg/util"
)

// Cache expensive calls in memory for 5 minutes, purging old entries every 10 minutes.
var cache = memoize.NewMemoizer(5*time.Minute, 10*time.Minute)

func getKey(query interface{}) string {
	if util.IsNil(query) {
		return ""
	}

	hash, err := hashstructure.Hash(query, hashstructure.FormatV2, nil)
	if err != nil {
		panic(err)
	}

	return fmt.Sprintf("%d", hash)
}

func MemoizeFunc(prefix string, query interface{}, callFunc func() (interface{}, error)) (interface{}, error, bool) {
	if conf.Config.IsDebug() {
		res, err := callFunc()
		return res, err, false
	}
	return cache.Memoize(fmt.Sprintf("%s_%s", prefix, getKey(query)), callFunc)
}
