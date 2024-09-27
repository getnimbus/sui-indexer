package repo

import (
	"context"

	"gorm.io/gorm"

	"feng-sui-core/internal/entity"
	"feng-sui-core/internal/repo/gorm_scope"
)

type TokenRepo interface {
	S() *gorm_scope.TokenScope
	GetOne(ctx context.Context, scopes ...func(db *gorm.DB) *gorm.DB) (*entity.Token, error)
	GetList(ctx context.Context, scopes ...func(db *gorm.DB) *gorm.DB) ([]*entity.Token, error)
}
