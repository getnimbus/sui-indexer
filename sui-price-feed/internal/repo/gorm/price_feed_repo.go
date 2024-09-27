package gorm

import (
	"context"

	"github.com/getnimbus/ultrago/u_validator"
	"github.com/google/uuid"
	"gorm.io/gorm"

	"sui-price-feed/internal/entity"
	"sui-price-feed/internal/repo"
	"sui-price-feed/internal/repo/gorm_scope"
	"sui-price-feed/internal/setting"
)

func NewPriceFeedRepo(
	baseRepo *baseRepo,
	s *gorm_scope.PriceFeedScope,
) repo.PriceFeedRepo {
	return &priceFeedRepo{
		baseRepo: baseRepo,
		s:        s,
	}
}

type priceFeedRepo struct {
	*baseRepo
	s *gorm_scope.PriceFeedScope
}

func (repo *priceFeedRepo) S() *gorm_scope.PriceFeedScope {
	return repo.s
}

func (repo *priceFeedRepo) GetOne(ctx context.Context, scopes ...func(db *gorm.DB) *gorm.DB) (*entity.PriceFeed, error) {
	if len(scopes) == 0 {
		return nil, setting.MissingConditionErr
	}

	var row PriceFeedDao
	q := repo.getDB(ctx).Model(&PriceFeedDao{}).
		Scopes(scopes...).
		First(&row)
	if err := q.Error; err != nil {
		return nil, err
	}
	return row.toStruct()
}

func (repo *priceFeedRepo) GetList(ctx context.Context, scopes ...func(db *gorm.DB) *gorm.DB) ([]*entity.PriceFeed, error) {
	if len(scopes) == 0 {
		return nil, setting.MissingConditionErr
	}

	var rows []*PriceFeedDao
	q := repo.getDB(ctx).Model(&PriceFeedDao{}).
		Scopes(scopes...).
		Find(&rows)
	if err := q.Error; err != nil {
		return nil, err
	}

	res := make([]*entity.PriceFeed, 0, q.RowsAffected)
	for _, row := range rows {
		item, err := row.toStruct()
		if err != nil {
			return nil, err
		}
		res = append(res, item)
	}
	return res, nil
}

func (repo *priceFeedRepo) Create(ctx context.Context, entity *entity.PriceFeed) error {
	row, err := new(PriceFeedDao).fromStruct(entity)
	if err != nil {
		return err
	}

	q := repo.getDB(ctx).Create(&row)
	return q.Error
}

type PriceFeedDao struct {
	ID            string  `gorm:"column:id;type:varchar;primaryKey;<-create"`
	TokenAddress  string  `gorm:"column:token_address;type:varchar;<-create"`
	TokenSymbol   string  `gorm:"column:token_symbol;type:varchar;<-create"`
	TokenName     string  `gorm:"column:token_name;type:varchar;<-create"`
	TokenDecimals int     `gorm:"column:token_decimals;type:varchar;<-create"`
	Chain         string  `gorm:"column:chain;type:varchar;<-create"`
	Price         float64 `gorm:"column:price;type:numeric;<-create"`
	Timestamp     int64   `gorm:"column:timestamp;type:bigint;<-create"`
}

func (dao *PriceFeedDao) TableName() string {
	return "price_feeds"
}

func (dao *PriceFeedDao) BeforeCreate(db *gorm.DB) error {
	if dao.ID == "" {
		dao.ID = uuid.NewString()
	} else if valid := u_validator.IsValidUUID(dao.ID); !valid {
		dao.ID = uuid.NewString()
	}
	return nil
}

func (dao *PriceFeedDao) fromStruct(item *entity.PriceFeed) (*PriceFeedDao, error) {
	dao.ID = item.ID
	dao.TokenAddress = item.TokenAddress
	dao.TokenSymbol = item.TokenSymbol
	dao.TokenName = item.TokenName
	dao.TokenDecimals = item.TokenDecimals
	dao.Chain = item.Chain
	dao.Price = item.Price
	dao.Timestamp = item.Timestamp

	return dao, nil
}

func (dao *PriceFeedDao) toStruct() (*entity.PriceFeed, error) {
	return &entity.PriceFeed{
		ID:            dao.ID,
		TokenAddress:  dao.TokenAddress,
		TokenSymbol:   dao.TokenSymbol,
		TokenName:     dao.TokenName,
		TokenDecimals: dao.TokenDecimals,
		Chain:         dao.Chain,
		Price:         dao.Price,
		Timestamp:     dao.Timestamp,
	}, nil
}
