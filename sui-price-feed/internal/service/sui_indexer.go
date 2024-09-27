package service

import (
	"context"
	"net/http"
	"strconv"
	"time"

	sui_client "github.com/coming-chat/go-sui/v2/client"

	"sui-price-feed/internal/conf"
)

func NewSuiIndexer() (*SuiIndexer, error) {
	client, err := sui_client.DialWithClient(conf.Config.SuiRpc, &http.Client{
		Transport: http.DefaultTransport.(*http.Transport).Clone(),
		Timeout:   2 * 60 * time.Second, // 2 mins
	})
	if err != nil {
		return nil, err
	}
	fallBackClient, _ := sui_client.DialWithClient(conf.Config.FallbackSuiRpc, &http.Client{
		Transport: http.DefaultTransport.(*http.Transport).Clone(),
		Timeout:   2 * 60 * time.Second, // 2 mins
	})

	return &SuiIndexer{
		client:         client,
		fallbackClient: fallBackClient,
	}, nil
}

type SuiIndexer struct {
	client         *sui_client.Client
	fallbackClient *sui_client.Client
}

func (svc *SuiIndexer) FetchLatestCheckpoint(ctx context.Context) (int64, error) {
	checkpoint, err := svc.client.GetLatestCheckpointSequenceNumber(ctx)
	if err != nil {
		return -1, err
	}
	return strconv.ParseInt(checkpoint, 10, 64)
}
