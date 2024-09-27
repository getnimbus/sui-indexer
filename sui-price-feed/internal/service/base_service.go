package service

import (
	"context"

	"sui-price-feed/internal/repo"
)

func NewBaseService(
	transactor repo.Transactor,
) BaseService {
	return &baseService{
		transactor: transactor,
	}
}

type BaseService interface {
	ExecTx(ctx context.Context, f func(funcCtx context.Context) error) error
}

type baseService struct {
	// maybe in the future we add send kafka msg or something here
	transactor repo.Transactor
}

func (svc *baseService) ExecTx(ctx context.Context, f func(funcCtx context.Context) error) error {
	return svc.transactor.Transaction(ctx, f)
}
