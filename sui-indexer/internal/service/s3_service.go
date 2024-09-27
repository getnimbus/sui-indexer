package service

import (
	"context"
	"io"
	"os"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/session"
	"github.com/aws/aws-sdk-go/service/s3"
	"github.com/aws/aws-sdk-go/service/s3/s3manager"
	"github.com/getnimbus/ultrago/u_logger"
)

func NewS3Service(
	sess *session.Session,
) S3Service {
	return &s3Service{
		sess: sess,
	}
}

type S3Service interface {
	GetClient() *s3.S3
	CreateBucket(ctx context.Context, bucketName string) error
	UploadFile(ctx context.Context, bucketName string, objectKey string, uploadFileDir string) error
	FileStreamWriter(ctx context.Context, bucket string, key string, errCh chan<- error) *io.PipeWriter
}

type s3Service struct {
	sess *session.Session
}

func (svc *s3Service) GetClient() *s3.S3 {
	return s3.New(svc.sess)
}

func (svc *s3Service) CreateBucket(ctx context.Context, bucketName string) error {
	ctx, logger := u_logger.GetLogger(ctx)

	_, err := svc.GetClient().CreateBucket(&s3.CreateBucketInput{
		Bucket: aws.String(bucketName),
	})
	if err != nil {
		logger.Errorf("create bucket %s failed, err=%v", bucketName, err)
		return err
	}
	logger.Infof("create bucket %s successful", bucketName)

	return nil
}

func (svc *s3Service) UploadFile(ctx context.Context, bucketName string, objectKey string, uploadFileDir string) error {
	ctx, logger := u_logger.GetLogger(ctx)

	// Create an uploader with the session and custom options
	uploader := s3manager.NewUploader(svc.sess, func(u *s3manager.Uploader) {
		u.PartSize = 16 * 1024 * 1024 // The minimum/default allowed part size is 5MB, we set this is 16MB
		u.Concurrency = 5             // default is 5
	})

	logger.Infof("loading parquet file to upload...")
	file, err := os.Open(uploadFileDir)
	if err != nil {
		logger.Errorf("cannot open filed %s, err=%v", uploadFileDir, err)
		return err
	}
	defer file.Close()

	logger.Infof("start uploading file...")
	// Upload the file to S3.
	result, err := uploader.Upload(&s3manager.UploadInput{
		Bucket: aws.String(bucketName),
		Key:    aws.String(objectKey),
		Body:   file,
	})
	if err != nil {
		logger.Errorf("upload file %s to bucket %s failed, err=%v", uploadFileDir, bucketName, err)
		return err
	}
	logger.Infof("success file uploaded to, %s", aws.StringValue(&result.Location))

	return nil
}

func (svc *s3Service) FileStreamWriter(ctx context.Context, bucket string, key string, errCh chan<- error) *io.PipeWriter {
	// Open a pipe.
	pr, pw := io.Pipe()

	// Upload from pr in a separate Go routine.
	go func() {
		uploader := s3manager.NewUploader(svc.sess, func(u *s3manager.Uploader) {
			u.PartSize = 5 * 1024 * 1024 // The minimum/default allowed part size is 5MB
			u.Concurrency = 2            // default is 5
		})

		_, err := uploader.UploadWithContext(
			ctx,
			&s3manager.UploadInput{
				Bucket: aws.String(bucket),
				Key:    aws.String(key),
				Body:   pr,
			})
		errCh <- err
	}()

	return pw
}
