package service

import (
	"context"
	"testing"

	"github.com/smartystreets/goconvey/convey"

	"feng-sui-core/internal/conf"
	"feng-sui-core/internal/infra"
)

func TestS3Service(t *testing.T) {
	ctx := context.Background()

	_ = conf.LoadConfig(".")

	convey.FocusConvey("TestS3Service", t, func() {
		//sess, cleanup, err := infra.NewMockAwsSession()
		//defer cleanup()
		sess, err := infra.NewAwsSession()
		convey.So(err, convey.ShouldBeNil)
		svc := NewS3Service(sess)

		convey.FocusConvey("TestS3Service_CreateBucket", func() {
			convey.Convey("TestS3Service_UploadFile", func() {
				err := svc.CreateBucket(ctx, conf.Config.AwsBucket)
				convey.So(err, convey.ShouldBeNil)

				err = svc.UploadFile(ctx, conf.Config.AwsBucket, "file", "/Users/lap01890/Projects/nimbus-bigdata/airflow/go-nimeth/2022-12-25-0me2cKF.parquet")
				convey.So(err, convey.ShouldBeNil)
			})

			convey.FocusConvey("TestS3Service_FileStreamWriter", func() {
				errCh := make(chan error, 1)
				pw := svc.FileStreamWriter(ctx, conf.Config.AwsBucket, "test.csv", errCh)
				_, err = pw.Write([]byte("abc,abc"))
				convey.So(err, convey.ShouldBeNil)
				_ = pw.Close()

				err := <-errCh
				convey.So(err, convey.ShouldBeNil)
			})
		})
	})
}
