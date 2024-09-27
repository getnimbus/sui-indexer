package entity

import (
	"time"
)

type Token struct {
	ID            string    `json:"id"`
	TokenAddress  string    `json:"token_address"`
	TokenSymbol   string    `json:"token_symbol"`
	TokenName     string    `json:"token_name"`
	TokenDecimals int       `json:"token_decimals"`
	Chain         string    `json:"chain"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}
