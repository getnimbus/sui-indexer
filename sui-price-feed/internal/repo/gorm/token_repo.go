package gorm

import (
	"context"

	"gorm.io/gorm"

	"sui-price-feed/internal/entity"
	"sui-price-feed/internal/repo"
	"sui-price-feed/internal/repo/gorm_scope"
	"sui-price-feed/internal/setting"
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
	BaseDao
	TokenAddress  string `gorm:"column:token_address;type:varchar;<-create"`
	TokenSymbol   string `gorm:"column:token_symbol;type:varchar;<-create"`
	TokenName     string `gorm:"column:token_name;type:varchar;<-create"`
	TokenDecimals int    `gorm:"column:token_decimals;type:varchar;<-create"`
	Chain         string `gorm:"column:chain;type:varchar;<-create"`
}

func (dao *TokenDao) TableName() string {
	return "tokens"
}

func (dao *TokenDao) fromStruct(item *entity.Token) (*TokenDao, error) {
	dao.BaseDao = *new(BaseDao).fromEntity(&item.Base)
	dao.TokenAddress = item.TokenAddress
	dao.TokenSymbol = item.TokenSymbol
	dao.TokenName = item.TokenName
	dao.TokenDecimals = item.TokenDecimals
	dao.Chain = item.Chain

	return dao, nil
}

func (dao *TokenDao) toStruct() (*entity.Token, error) {
	return &entity.Token{
		Base:          *dao.BaseDao.toEntity(),
		TokenAddress:  dao.TokenAddress,
		TokenSymbol:   dao.TokenSymbol,
		TokenName:     dao.TokenName,
		TokenDecimals: dao.TokenDecimals,
		Chain:         dao.Chain,
	}, nil
}
