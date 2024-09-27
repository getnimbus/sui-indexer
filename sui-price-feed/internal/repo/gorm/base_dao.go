package gorm

import (
	"time"

	"github.com/getnimbus/ultrago/u_validator"
	"github.com/google/uuid"
	"gorm.io/gorm"

	"sui-price-feed/internal/entity"
)

type BaseDao struct {
	ID        string    `gorm:"column:id;type:varchar(36);primary_key;<-:create"`
	CreatedAt time.Time `gorm:"column:created_at;autoCreateTime;<-:create"`
	UpdatedAt time.Time `gorm:"column:updated_at;autoUpdateTime"`
}

// BeforeCreate will set a UUID rather than numeric ID.
func (dao *BaseDao) BeforeCreate(db *gorm.DB) error {
	if dao.ID == "" {
		dao.ID = uuid.NewString()
	} else if valid := u_validator.IsValidUUID(dao.ID); !valid {
		dao.ID = uuid.NewString()
	}
	return nil
}

func (dao *BaseDao) fromEntity(item *entity.Base) *BaseDao {
	dao.ID = item.ID
	dao.CreatedAt = item.CreatedAt
	dao.UpdatedAt = item.UpdatedAt
	return dao
}

func (dao *BaseDao) toEntity() *entity.Base {
	return &entity.Base{
		ID:        dao.ID,
		CreatedAt: dao.CreatedAt,
		UpdatedAt: dao.UpdatedAt,
	}
}
