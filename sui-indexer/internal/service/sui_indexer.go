package service

import (
	"context"
	"strconv"

	sui_client "github.com/coming-chat/go-sui/v2/client"
	"github.com/coming-chat/go-sui/v2/types"

	"feng-sui-core/internal/entity_dto/sui_model"
)

func NewSuiIndexer(client, fallbackClient *sui_client.Client) *SuiIndexer {
	return &SuiIndexer{
		client:         client,
		fallbackClient: fallbackClient,
	}
}

type SuiIndexer struct {
	client         *sui_client.Client
	fallbackClient *sui_client.Client
}

func (svc *SuiIndexer) FetchLatestCheckpoint(ctx context.Context) (string, error) {
	return svc.client.GetLatestCheckpointSequenceNumber(ctx)
}

func (svc *SuiIndexer) FetchCheckpoint(ctx context.Context, id string) (*sui_model.Checkpoint, error) {
	var resp sui_model.Checkpoint
	if err := svc.client.CallContext(ctx, &resp, sui_client.SuiMethod("getCheckpoint"), id); err == nil {
		return &resp, nil
	}
	// fallback query
	return &resp, svc.fallbackClient.CallContext(ctx, &resp, sui_client.SuiMethod("getCheckpoint"), id)
}

func (svc *SuiIndexer) FetchCheckpoints(ctx context.Context, checkpointId string, limit int) ([]*sui_model.Checkpoint, error) {
	if limit <= 0 || limit >= 100 {
		limit = 100
	}

	fromId, err := strconv.ParseInt(checkpointId, 10, 64)
	if err != nil {
		return nil, err
	}
	if fromId > 0 {
		// E.g. fromId=1 then method `getCheckpoints` will return checkpoints from 2
		// Because of that we need to decrease `fromId` by 1
		fromId = fromId - 1
	}

	var resp = struct {
		Data        []*sui_model.Checkpoint `json:"data"`
		NextCursor  string                  `json:"nextCursor"`
		HasNextPage bool                    `json:"hasNextPage"`
	}{}
	if err := svc.client.CallContext(ctx, &resp, sui_client.SuiMethod("getCheckpoints"), strconv.FormatInt(fromId, 10), limit, false); err == nil {
		return resp.Data, nil
	}
	// fallback query
	return resp.Data, svc.fallbackClient.CallContext(ctx, &resp, sui_client.SuiMethod("getCheckpoints"), strconv.FormatInt(fromId, 10), limit, false)
}

func (svc *SuiIndexer) FetchTxs(ctx context.Context, digests ...string) ([]*sui_model.Transaction, error) {
	resp := make([]*sui_model.Transaction, 0)
	if err := svc.client.CallContext(ctx, &resp, sui_client.SuiMethod("multiGetTransactionBlocks"), digests, types.SuiTransactionBlockResponseOptions{
		ShowInput:          true,
		ShowEffects:        true,
		ShowEvents:         true,
		ShowObjectChanges:  true,
		ShowBalanceChanges: true,
	}); err == nil {
		return resp, nil
	}
	// fallback query
	return resp, svc.fallbackClient.CallContext(ctx, &resp, sui_client.SuiMethod("multiGetTransactionBlocks"), digests, types.SuiTransactionBlockResponseOptions{
		ShowInput:          true,
		ShowEffects:        true,
		ShowEvents:         true,
		ShowObjectChanges:  true,
		ShowBalanceChanges: true,
	})
}
