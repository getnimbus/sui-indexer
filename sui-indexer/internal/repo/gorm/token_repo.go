package gorm

import (
	"context"
	"time"

	"gorm.io/gorm"

	"feng-sui-core/internal/entity"
	"feng-sui-core/internal/repo"
	"feng-sui-core/internal/repo/gorm_scope"
	"feng-sui-core/internal/setting"
)

func NewTokenRepo(
	baseRepo *baseRepo,
	s *gorm_scope.TokenScope,
) repo.TokenRepo {
	return &tokenRepo{
		baseRepo: baseRepo,
		s:        s,
	}
}

type tokenRepo struct {
	*baseRepo
	s *gorm_scope.TokenScope
}

func (repo *tokenRepo) S() *gorm_scope.TokenScope {
	return repo.s
}

func (repo *tokenRepo) GetOne(ctx context.Context, scopes ...func(db *gorm.DB) *gorm.DB) (*entity.Token, error) {
	if len(scopes) == 0 {
		return nil, setting.MissingConditionErr
	}

	var row TokenDao
	q := repo.getDB(ctx).Model(&TokenDao{}).
		Scopes(scopes...).
		First(&row)
	if err := q.Error; err != nil {
		return nil, err
	}
	return row.toStruct()
}

func (repo *tokenRepo) GetList(ctx context.Context, scopes ...func(db *gorm.DB) *gorm.DB) ([]*entity.Token, error) {
	if len(scopes) == 0 {
		return nil, setting.MissingConditionErr
	}

	var rows []*TokenDao
	q := repo.getDB(ctx).Model(&TokenDao{}).
		Scopes(scopes...).
		Find(&rows)
	if err := q.Error; err != nil {
		return nil, err
	}

	res := make([]*entity.Token, 0, q.RowsAffected)
	for _, row := range rows {
		item, err := row.toStruct()
		if err != nil {
			return nil, err
		}
		res = append(res, item)
	}
	return res, nil
}

type TokenDao struct {
	ID            string    `gorm:"column:id;type:varchar;not null;primaryKey;<-create"`
	TokenAddress  string    `gorm:"column:token_address;type:text;<-create"`
	TokenSymbol   string    `gorm:"column:token_symbol;type:text;<-create"`
	TokenName     string    `gorm:"column:token_name;type:text;<-create"`
	TokenDecimals int       `gorm:"column:token_decimals;type:int;<-create"`
	Chain         string    `gorm:"column:chain;type:text;<-create"`
	CreatedAt     time.Time `gorm:"column:created_at;type:timestamp;autoCreateTime;<-create"`
	UpdatedAt     time.Time `gorm:"column:updated_at;type:timestamp;autoUpdateTime;<-create"`
}

func (dao *TokenDao) TableName() string {
	return "tokens"
}

func (dao *TokenDao) fromStruct(item *entity.Token) (*TokenDao, error) {
	dao.ID = item.ID
	dao.TokenAddress = item.TokenAddress
	dao.TokenSymbol = item.TokenSymbol
	dao.TokenName = item.TokenName
	dao.TokenDecimals = item.TokenDecimals
	dao.Chain = item.Chain
	dao.CreatedAt = item.CreatedAt
	dao.UpdatedAt = item.UpdatedAt

	return dao, nil
}

func (dao *TokenDao) toStruct() (*entity.Token, error) {
	return &entity.Token{
		ID:            dao.ID,
		TokenAddress:  dao.TokenAddress,
		TokenSymbol:   dao.TokenSymbol,
		TokenName:     dao.TokenName,
		TokenDecimals: dao.TokenDecimals,
		Chain:         dao.Chain,
		CreatedAt:     dao.CreatedAt,
		UpdatedAt:     dao.UpdatedAt,
	}, nil
}
