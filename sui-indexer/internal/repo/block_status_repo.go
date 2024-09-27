package repo

import (
	"context"

	"gorm.io/gorm"

	"feng-sui-core/internal/entity"
	"feng-sui-core/internal/repo/gorm_scope"
)

type BlockStatusRepo interface {
	S() *gorm_scope.BlockStatusScope
	GetOne(ctx context.Context, scopes ...func(db *gorm.DB) *gorm.DB) (*entity.BlockStatus, error)
	GetList(ctx context.Context, scopes ...func(db *gorm.DB) *gorm.DB) ([]*entity.BlockStatus, error)
	CreateMany(ctx context.Context, entities ...*entity.BlockStatus) error
	Save(ctx context.Context, entity *entity.BlockStatus) error
	UpdateOne(ctx context.Context, entity *entity.BlockStatus) error
	UpdateStatus(ctx context.Context, status int, ids ...string) error
	UpdateFailedStatus(ctx context.Context) error
	GetCurrentBlock(ctx context.Context) (int64, error)
}
