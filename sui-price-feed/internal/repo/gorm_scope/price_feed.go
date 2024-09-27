package gorm_scope

type PriceFeedScope struct {
	*base
}

func NewPriceFeed(b *base) *PriceFeedScope {
	return &PriceFeedScope{base: b}
}
