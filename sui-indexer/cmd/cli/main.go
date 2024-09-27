package main

import (
	"flag"
	"os"
	"reflect"
	"time"

	"github.com/getnimbus/ultrago/u_graceful"
	"github.com/getnimbus/ultrago/u_logger"
	"github.com/getnimbus/ultrago/u_monitor"
	"github.com/sirupsen/logrus"

	"feng-sui-core/internal/conf"
	"feng-sui-core/internal/repo/gorm"
)

func init() {
	os.Setenv("TZ", "UTC")
	_, err := time.LoadLocation("UTC")
	if err != nil {
		panic(err)
	}
	if conf.Config.IsDebug() {
		u_logger.WithFormatter(logrus.DebugLevel)
	} else {
		u_logger.WithFormatter(logrus.InfoLevel)
	}
}

func main() {
	ctx, logger := u_logger.GetLogger(u_graceful.NewCtx())

	// load config env
	if err := conf.LoadConfig("."); err != nil {
		logger.Fatalf("cannot load config: %v", err)
	}

	// migration code
	if err := gorm.RunMigration(ctx); err != nil {
		logger.Fatalf("failed to migration db: %v", err)
	}

	app, cleanup, err := initCLI(ctx)
	if err != nil {
		logger.Fatalf("cannot init app: %v", err)
	}
	defer cleanup() // close connection such as mysql, redis,...

	actionPtr := flag.String("action", "", "action: SyncTrades")
	param1Ptr := flag.String("param1", "", "param1 of action")
	param2Ptr := flag.String("param2", "", "param2 of action")
	param3Ptr := flag.String("param3", "", "param3 of action")
	param4Ptr := flag.String("param4", "", "param4 of action")
	param5Ptr := flag.String("param5", "", "param5 of action")
	flag.Parse()

	// for monitoring memory
	go u_monitor.Monitor(ctx, 30*time.Second)

	if flag.Parsed() {
		if *actionPtr == "" {
			flag.PrintDefaults()
			os.Exit(1)
		}
		logger.Infof("actionPtr: %s, param1Ptr: %s, param2Ptr: %s, param3Ptr: %s, param4Ptr: %s, param5Ptr: %s\n",
			*actionPtr, *param1Ptr, *param2Ptr, *param3Ptr, *param4Ptr, *param5Ptr)

		results := reflect.ValueOf(app).MethodByName(*actionPtr).Call([]reflect.Value{
			reflect.ValueOf(ctx),
			reflect.ValueOf(*param1Ptr),
			reflect.ValueOf(*param2Ptr),
			reflect.ValueOf(*param3Ptr),
			reflect.ValueOf(*param4Ptr),
			reflect.ValueOf(*param5Ptr),
		})
		if len(results) >= 1 {
			result := results[0]
			if result.IsNil() {
				return
			} else {
				cleanup()
				logger.Fatalf("%s failed: %v", *actionPtr, result.Interface())
			}
		}
	}
}
