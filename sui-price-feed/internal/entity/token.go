package entity

type Token struct {
	Base
	TokenAddress  string `json:"token_address"`
	TokenSymbol   string `json:"token_symbol"`
	TokenName     string `json:"token_name"`
	TokenDecimals int    `json:"token_decimals"`
	Chain         string `json:"chain"`
}
