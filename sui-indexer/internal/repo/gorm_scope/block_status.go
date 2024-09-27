package gorm_scope

import (
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type BlockStatusScope struct {
	*base
}

func NewBlockStatus(b *base) *BlockStatusScope {
	return &BlockStatusScope{base: b}
}

func (s *BlockStatusScope) Locking() func(db *gorm.DB) *gorm.DB {
	return func(db *gorm.DB) *gorm.DB {
		return db.Clauses(clause.Locking{
			Strength: "UPDATE",
			Options:  "SKIP LOCKED",
		})
	}
}

func (s *BlockStatusScope) FilterStatuses(statuses ...int) func(db *gorm.DB) *gorm.DB {
	return func(db *gorm.DB) *gorm.DB {
		return db.Where("status IN ?", statuses)
	}
}

func (s *BlockStatusScope) FilterType(queryType int) func(db *gorm.DB) *gorm.DB {
	return func(db *gorm.DB) *gorm.DB {
		return db.Where("type = ?", queryType)
	}
}
