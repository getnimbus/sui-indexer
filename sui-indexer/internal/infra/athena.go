package infra

import (
	"database/sql"

	drv "github.com/uber/athenadriver/go"

	"feng-sui-core/internal/conf"
)

func NewAthenaSession(outputBucket string) (*sql.DB, error) {
	conf, _ := drv.NewDefaultConfig(
		outputBucket,
		conf.Config.AwsRegion,
		conf.Config.AwsAccessKeyId,
		conf.Config.AwsSecretAccessKey,
	)

	dsn := conf.Stringify()
	return sql.Open(drv.DefaultDBName, dsn)
}
