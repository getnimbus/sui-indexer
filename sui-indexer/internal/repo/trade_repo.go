package repo

import (
	"context"

	"gorm.io/gorm"

	"feng-sui-core/internal/entity"
	"feng-sui-core/internal/repo/gorm_scope"
)

type TradeRepo interface {
	S() *gorm_scope.TradeScope
	GetOne(ctx context.Context, scopes ...func(db *gorm.DB) *gorm.DB) (*entity.Trade, error)
	GetList(ctx context.Context, scopes ...func(db *gorm.DB) *gorm.DB) ([]*entity.Trade, error)
	CreateMany(ctx context.Context, items ...*entity.Trade) error
}
