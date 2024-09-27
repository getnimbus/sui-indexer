package gorm

import (
	"context"
	"time"

	"github.com/golang-module/carbon/v2"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"feng-sui-core/internal/entity"
	"feng-sui-core/internal/repo"
	"feng-sui-core/internal/repo/gorm_scope"
	"feng-sui-core/internal/setting"
)

func NewBlockStatusRepo(
	baseRepo *baseRepo,
	s *gorm_scope.BlockStatusScope,
) repo.BlockStatusRepo {
	return &blockStatusRepo{
		baseRepo: baseRepo,
		s:        s,
	}
}

type blockStatusRepo struct {
	*baseRepo
	s *gorm_scope.BlockStatusScope
}

func (repo *blockStatusRepo) S() *gorm_scope.BlockStatusScope {
	return repo.s
}

func (repo *blockStatusRepo) GetOne(ctx context.Context, scopes ...func(db *gorm.DB) *gorm.DB) (*entity.BlockStatus, error) {
	if len(scopes) == 0 {
		return nil, setting.MissingConditionErr
	}

	var row BlockStatusDao
	q := repo.getDB(ctx).Model(&BlockStatusDao{}).
		Scopes(scopes...).
		First(&row)
	if err := q.Error; err != nil {
		return nil, err
	}
	return row.toStruct()
}

func (repo *blockStatusRepo) GetList(ctx context.Context, scopes ...func(db *gorm.DB) *gorm.DB) ([]*entity.BlockStatus, error) {
	if len(scopes) == 0 {
		return nil, setting.MissingConditionErr
	}

	var rows []*BlockStatusDao
	q := repo.getDB(ctx).Model(&BlockStatusDao{}).
		Scopes(scopes...).
		Find(&rows)
	if err := q.Error; err != nil {
		return nil, err
	}

	res := make([]*entity.BlockStatus, 0, q.RowsAffected)
	for _, row := range rows {
		item, err := row.toStruct()
		if err != nil {
			return nil, err
		}
		res = append(res, item)
	}
	return res, nil
}

func (repo *blockStatusRepo) CreateMany(ctx context.Context, entities ...*entity.BlockStatus) error {
	if len(entities) == 0 {
		return nil
	}

	var rows = make([]*BlockStatusDao, 0, len(entities))
	for _, item := range entities {
		row, err := new(BlockStatusDao).fromStruct(item)
		if err != nil {
			return err
		}
		rows = append(rows, row)
	}

	q := repo.getDB(ctx).CreateInBatches(rows, 200)
	return q.Error
}

func (repo *blockStatusRepo) Save(ctx context.Context, entity *entity.BlockStatus) error {
	row, err := new(BlockStatusDao).fromStruct(entity)
	if err != nil {
		return err
	}

	q := repo.getDB(ctx).
		Clauses(clause.OnConflict{DoNothing: true}).
		Create(&row)
	return q.Error
}

func (repo *blockStatusRepo) UpdateOne(ctx context.Context, entity *entity.BlockStatus) error {
	row, err := new(BlockStatusDao).fromStruct(entity)
	if err != nil {
		return err
	}

	q := repo.getDB(ctx).Updates(&row)
	return q.Error
}

func (repo *blockStatusRepo) UpdateStatus(ctx context.Context, status int, ids ...string) error {
	q := repo.getDB(ctx).
		Model(&BlockStatusDao{}).
		Where("id IN ?", ids).
		Updates(map[string]interface{}{
			"status":     status,
			"updated_at": time.Now(),
		})
	return q.Error
}

func (repo *blockStatusRepo) GetCurrentBlock(ctx context.Context) (int64, error) {
	var currentBlock int64
	if err := repo.getDB(ctx).Raw(`SELECT
		MAX(block_number) AS current_block
	FROM block_status
	WHERE type = ? AND status = ?`, entity.BlockStatusType_REALTIME, entity.BlockStatus_DONE).Scan(&currentBlock).Error; err != nil {
		return 0, err
	}
	return currentBlock, nil
}

func (repo *blockStatusRepo) UpdateFailedStatus(ctx context.Context) error {
	q := repo.getDB(ctx).
		Model(&BlockStatusDao{}).
		Where("status = ? AND updated_at < ?", entity.BlockStatus_PROCESSING, carbon.Now().AddHours(-1).ToDateTimeString(carbon.UTC)).
		Update("status", entity.BlockStatus_FAIL)
	return q.Error
}

type BlockStatusDao struct {
	BaseDao
	Chain       string `gorm:"column:chain;type:varchar(25);not null;uniqueIndex:idx_block_status_chain;<-create"`
	BlockNumber int64  `gorm:"column:block_number;type:bigint;not null;<-create"`
	Status      int    `gorm:"column:status;type:int;not null;default:0"`
	Type        int    `gorm:"column:type;type:int;not null;default:0;<-create"`
}

func (dao *BlockStatusDao) TableName() string {
	return "block_status"
}

func (dao *BlockStatusDao) fromStruct(item *entity.BlockStatus) (*BlockStatusDao, error) {
	dao.BaseDao = *new(BaseDao).fromEntity(&item.Base)
	dao.Chain = item.Chain
	dao.BlockNumber = item.BlockNumber
	dao.Status = item.Status
	dao.Type = item.Type

	return dao, nil
}

func (dao *BlockStatusDao) toStruct() (*entity.BlockStatus, error) {
	return &entity.BlockStatus{
		Base:        *dao.BaseDao.toEntity(),
		Chain:       dao.Chain,
		BlockNumber: dao.BlockNumber,
		Status:      dao.Status,
		Type:        dao.Type,
	}, nil
}
