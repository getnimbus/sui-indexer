package repo

import (
	"context"

	"gorm.io/gorm"

	"sui-price-feed/internal/entity"
	"sui-price-feed/internal/repo/gorm_scope"
)

type PriceFeedRepo interface {
	S() *gorm_scope.PriceFeedScope
	GetOne(ctx context.Context, scopes ...func(db *gorm.DB) *gorm.DB) (*entity.PriceFeed, error)
	GetList(ctx context.Context, scopes ...func(db *gorm.DB) *gorm.DB) ([]*entity.PriceFeed, error)
	Create(ctx context.Context, entity *entity.PriceFeed) error
}
