package gorm_scope

type TradeScope struct {
	*base
}

func NewTrade(b *base) *TradeScope {
	return &TradeScope{base: b}
}
