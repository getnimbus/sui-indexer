package entity

import "fmt"

type PriceFeed struct {
	ID            string  `json:"id"`
	TokenAddress  string  `json:"token_address"`
	TokenSymbol   string  `json:"token_symbol"`
	TokenName     string  `json:"token_name"`
	TokenDecimals int     `json:"token_decimals"`
	Chain         string  `json:"chain"`
	Price         float64 `json:"price"`
	Timestamp     int64   `json:"timestamp"`
}

func (p *PriceFeed) PartitionKey() string {
	return fmt.Sprintf("%s-%s", p.Chain, p.TokenAddress)
}
