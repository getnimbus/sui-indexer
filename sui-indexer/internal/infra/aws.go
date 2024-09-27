package infra

import (
	"fmt"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/credentials"
	"github.com/aws/aws-sdk-go/aws/session"
	"github.com/orlangure/gnomock"
	"github.com/orlangure/gnomock/preset/localstack"

	"feng-sui-core/internal/conf"
)

func NewAwsSession() (*session.Session, error) {
	config := &aws.Config{
		Region: aws.String(conf.Config.AwsRegion),
		Credentials: credentials.NewStaticCredentials(
			conf.Config.AwsAccessKeyId,
			conf.Config.AwsSecretAccessKey,
			"", // a token will be created when the session it's used
		),
	}
	if conf.Config.IsLocal() {
		config.Endpoint = aws.String(conf.Config.AwsEndpoint)
		config.S3ForcePathStyle = aws.Bool(true)
	}
	sess, err := session.NewSession(config)
	if err != nil {
		return nil, err
	}
	return sess, nil
}

func NewMockAwsSession() (*session.Session, func(), error) {
	p := localstack.Preset(localstack.WithServices(localstack.S3))
	c, _ := gnomock.Start(p)
	cleanup := func() { _ = gnomock.Stop(c) }

	s3Endpoint := fmt.Sprintf("http://%s/", c.Address(localstack.APIPort))
	config := &aws.Config{
		Region:           aws.String("us-east-1"),
		Endpoint:         aws.String(s3Endpoint),
		S3ForcePathStyle: aws.Bool(true),
		Credentials:      credentials.NewStaticCredentials("a", "b", ""),
	}

	sess, err := session.NewSession(config)
	if err != nil {
		return nil, nil, err
	}
	return sess, cleanup, nil
}
