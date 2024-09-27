package gorm_scope

import (
	"fmt"
	"strings"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type base struct {
}

func NewBase() *base {
	return new(base)
}

func (base) PreloadTables(tables ...string) func(db *gorm.DB) *gorm.DB {
	return func(db *gorm.DB) *gorm.DB {
		if len(tables) == 0 {
			db.AddError(fmt.Errorf("missing tables"))
			return db
		}
		for _, table := range tables {
			db = db.Preload(table)
		}
		return db
	}
}

func (base) JoinTables(tables ...string) func(db *gorm.DB) *gorm.DB {
	return func(db *gorm.DB) *gorm.DB {
		if len(tables) == 0 {
			db.AddError(fmt.Errorf("missing tables"))
			return db
		}
		for _, table := range tables {
			db = db.Joins(table)
		}
		return db
	}
}

func (base) IdEqual(ids ...string) func(db *gorm.DB) *gorm.DB {
	return func(db *gorm.DB) *gorm.DB {
		if len(ids) > 1 {
			return db.Where(clause.Eq{
				Column: "id",
				Value:  ids,
			})
		} else if len(ids) == 1 {
			return db.Where(clause.Eq{
				Column: "id",
				Value:  ids[0],
			})
		} else {
			db.AddError(fmt.Errorf("missing ids"))
			return db
		}
	}
}

func (base) ColumnEqual(column string, values ...string) func(db *gorm.DB) *gorm.DB {
	return func(db *gorm.DB) *gorm.DB {
		if len(values) > 1 {
			return db.Where(clause.Eq{
				Column: column,
				Value:  values,
			})
		} else if len(values) == 1 {
			return db.Where(clause.Eq{
				Column: column,
				Value:  values[0],
			})
		} else {
			db.AddError(fmt.Errorf("missing values"))
			return db
		}
	}
}

func (base) ColumnLike(column string, value string) func(db *gorm.DB) *gorm.DB {
	return func(db *gorm.DB) *gorm.DB {
		if len(strings.TrimSpace(value)) == 0 {
			db.AddError(fmt.Errorf("empty value"))
			return db
		}
		return db.Where(clause.Like{
			Column: column,
			Value:  fmt.Sprintf("%%%s%%", value),
		})
	}
}

func (base) SelectColumns(columns ...interface{}) func(db *gorm.DB) *gorm.DB {
	return func(db *gorm.DB) *gorm.DB {
		if len(columns) > 1 {
			return db.Select(columns[0], columns[1:]...)
		} else if len(columns) == 1 {
			return db.Select(columns[0])
		} else {
			return db
		}
	}
}

func (base) SortBy(field string, order string) func(db *gorm.DB) *gorm.DB {
	return func(db *gorm.DB) *gorm.DB {
		switch strings.ToLower(order) {
		case "asc", "desc":
		case "":
			order = "asc"
		default:
			db.AddError(fmt.Errorf("format order not right"))
			return db
		}
		return db.Order(fmt.Sprintf("%v %v", field, order))
	}
}

func (base) LimitOffset(l int, o int) func(db *gorm.DB) *gorm.DB {
	return func(db *gorm.DB) *gorm.DB {
		var limit, offset = 10, 0
		if l > 0 {
			limit = l
		}
		if o > 0 {
			offset = o
		}
		return db.Limit(limit).Offset(offset)
	}
}
