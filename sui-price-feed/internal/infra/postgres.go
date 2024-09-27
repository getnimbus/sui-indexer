package infra

import (
	"time"

	"github.com/getnimbus/ultrago/u_logger"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	"sui-price-feed/internal/conf"
)

func NewPostgresSession() (*gorm.DB, func(), error) {
	var (
		log   = u_logger.NewLogger()
		level = logger.Warn
	)
	if conf.Config.IsDebug() {
		level = logger.Info
	}

	db, err := gorm.Open(postgres.New(postgres.Config{
		DSN:                  conf.Config.GormDsn,
		PreferSimpleProtocol: true, // disables implicit prepared statement usage
	}), &gorm.Config{
		PrepareStmt: false,
		Logger: u_logger.NewGORMLogger(logger.Config{
			SlowThreshold:             time.Second,
			LogLevel:                  level,
			IgnoreRecordNotFoundError: true,
			Colorful:                  false,
		}),
	})
	if err != nil {
		log.Errorf("init postgres session failed: %v", err)
		return nil, nil, err
	}

	sqlDB, err := db.DB()
	if err != nil {
		log.Errorf("init postgres pool failed: %v", err)
		return nil, nil, err
	}

	sqlDB.SetMaxIdleConns(1)
	sqlDB.SetMaxOpenConns(3)
	sqlDB.SetConnMaxLifetime(1 * time.Hour)
	sqlDB.SetConnMaxIdleTime(15 * time.Second)

	cleanup := func() {
		if err := sqlDB.Close(); err != nil {
			log.Error(err)
		}
	}

	return db, cleanup, nil
}
