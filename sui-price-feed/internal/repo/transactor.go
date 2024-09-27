package repo

import (
	"context"
)

type Transactor interface {
	Transaction(ctx context.Context, f func(funcCtx context.Context) error) error
}
