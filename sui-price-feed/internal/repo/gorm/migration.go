package gorm

import (
	"context"
	"time"

	"github.com/getnimbus/ultrago/u_logger"

	"sui-price-feed/internal/conf"
	"sui-price-feed/internal/infra"
)

func RunMigration(ctx context.Context) error {
	if !conf.Config.IsMigration() {
		return nil
	}

	ctx, logger := u_logger.GetLogger(ctx)
	logger.Infof("Run migration")
	db, _, err := infra.NewPostgresSession()
	if err != nil {
		logger.Error(err)
		return err
	}
	// db.DisableForeignKeyConstraintWhenMigrating = true
	sqlDB, err := db.DB()
	if err != nil {
		logger.Fatal(err)
		return err
	}
	sqlDB.SetMaxOpenConns(30)
	sqlDB.SetConnMaxLifetime(time.Minute)

	err = db.WithContext(ctx).AutoMigrate(
		// add schema to migration
		//&TokenDao{},
		&PriceFeedDao{},
	)
	if err != nil {
		logger.Fatal(err)
		return err
	}
	return nil
}
