package gorm

import (
	"context"
	"time"

	"github.com/getnimbus/ultrago/u_validator"
	"github.com/google/uuid"
	"gorm.io/gorm"

	"feng-sui-core/internal/entity"
	"feng-sui-core/internal/repo"
	"feng-sui-core/internal/repo/gorm_scope"
	"feng-sui-core/internal/setting"
)

func NewTradeRepo(
	baseRepo *baseRepo,
	s *gorm_scope.TradeScope,
) repo.TradeRepo {
	return &tradeRepo{
		baseRepo: baseRepo,
		s:        s,
	}
}

type tradeRepo struct {
	*baseRepo
	s *gorm_scope.TradeScope
}

func (repo *tradeRepo) S() *gorm_scope.TradeScope {
	return repo.s
}

func (repo *tradeRepo) GetOne(ctx context.Context, scopes ...func(db *gorm.DB) *gorm.DB) (*entity.Trade, error) {
	if len(scopes) == 0 {
		return nil, setting.MissingConditionErr
	}

	var row TradeDao
	q := repo.getDB(ctx).Model(&TradeDao{}).
		Scopes(scopes...).
		First(&row)
	if err := q.Error; err != nil {
		return nil, err
	}
	return row.toStruct()
}

func (repo *tradeRepo) GetList(ctx context.Context, scopes ...func(db *gorm.DB) *gorm.DB) ([]*entity.Trade, error) {
	if len(scopes) == 0 {
		return nil, setting.MissingConditionErr
	}

	var rows []*TradeDao
	q := repo.getDB(ctx).Model(&TradeDao{}).
		Scopes(scopes...).
		Find(&rows)
	if err := q.Error; err != nil {
		return nil, err
	}

	res := make([]*entity.Trade, 0, q.RowsAffected)
	for _, row := range rows {
		item, err := row.toStruct()
		if err != nil {
			return nil, err
		}
		res = append(res, item)
	}
	return res, nil
}

func (repo *tradeRepo) CreateMany(ctx context.Context, items ...*entity.Trade) error {
	if len(items) == 0 {
		return nil
	}

	rows := make([]*TradeDao, 0, len(items))
	for _, item := range items {
		row, err := new(TradeDao).fromStruct(item)
		if err != nil {
			return err
		}
		rows = append(rows, row)
	}

	q := repo.getDB(ctx).CreateInBatches(rows, 200)
	return q.Error
}

type TradeDao struct {
	ID                  string    `gorm:"column:id;type:varchar;not null;primaryKey;<-create"`
	Block               int64     `gorm:"column:block;type:int4;not null;<-create"`
	TxHash              string    `gorm:"column:tx_hash;type:text;not null;<-create"`
	FromTokenAddress    string    `gorm:"column:from_token_address;type:text;not null;<-create"`
	ToTokenAddress      string    `gorm:"column:to_token_address;type:text;not null;<-create"`
	SenderAddress       string    `gorm:"column:sender_address;type:text;not null;<-create"`
	OriginSenderAddress string    `gorm:"column:origin_sender_address;type:text;not null;<-create"`
	QuanlityIn          float64   `gorm:"column:quanlity_in;type:numeric;not null;<-create"`
	QuanlityOut         float64   `gorm:"column:quanlity_out;type:numeric;not null;<-create"`
	LogIndex            int       `gorm:"column:log_index;type:int4;not null;<-create"`
	ExchangeName        string    `gorm:"column:exchange_name;type:text;not null;<-create"`
	Timestamp           time.Time `gorm:"column:timestamp;type:timestamptz;not null;<-create"`
	PoolAddress         string    `gorm:"column:pool_address;type:text;not null;<-create"`
	AmountUsd           float64   `gorm:"column:amount_usd;type:numeric;not null;<-create"`
	Chain               string    `gorm:"column:chain;type:text;not null;<-create"`
	Fee                 float64   `gorm:"column:fee;type:numeric;not null;default:0;<-create"`
	NativePrice         float64   `gorm:"column:native_price;type:numeric;not null;default:0;<-create"`
}

func (dao *TradeDao) TableName() string {
	return "trade"
}

func (dao *TradeDao) BeforeCreate(db *gorm.DB) error {
	if dao.ID == "" {
		dao.ID = uuid.NewString()
	} else if valid := u_validator.IsValidUUID(dao.ID); !valid {
		dao.ID = uuid.NewString()
	}
	return nil
}

func (dao *TradeDao) fromStruct(item *entity.Trade) (*TradeDao, error) {
	dao.ID = item.ID
	dao.Block = item.Block
	dao.TxHash = item.TxHash
	dao.FromTokenAddress = item.FromTokenAddress
	dao.ToTokenAddress = item.ToTokenAddress
	dao.SenderAddress = item.SenderAddress
	dao.OriginSenderAddress = item.OriginSenderAddress
	dao.QuanlityIn = item.QuanlityIn
	dao.QuanlityOut = item.QuanlityOut
	dao.LogIndex = item.LogIndex
	dao.ExchangeName = item.ExchangeName
	dao.Timestamp = item.Timestamp
	dao.PoolAddress = item.PoolAddress
	dao.AmountUsd = item.AmountUsd
	dao.Chain = item.Chain
	dao.Fee = item.Fee
	dao.NativePrice = item.NativePrice

	return dao, nil
}

func (dao *TradeDao) toStruct() (*entity.Trade, error) {
	return &entity.Trade{
		ID:                  dao.ID,
		Block:               dao.Block,
		TxHash:              dao.TxHash,
		FromTokenAddress:    dao.FromTokenAddress,
		ToTokenAddress:      dao.ToTokenAddress,
		SenderAddress:       dao.SenderAddress,
		OriginSenderAddress: dao.OriginSenderAddress,
		QuanlityIn:          dao.QuanlityIn,
		QuanlityOut:         dao.QuanlityOut,
		LogIndex:            dao.LogIndex,
		ExchangeName:        dao.ExchangeName,
		Timestamp:           dao.Timestamp,
		PoolAddress:         dao.PoolAddress,
		AmountUsd:           dao.AmountUsd,
		Chain:               dao.Chain,
		Fee:                 dao.Fee,
		NativePrice:         dao.NativePrice,
	}, nil
}
