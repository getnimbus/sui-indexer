package entity

import (
	"time"
)

type Trade struct {
	ID                  string    `json:"id"`
	Block               int64     `json:"block"`
	TxHash              string    `json:"tx_hash"`
	FromTokenAddress    string    `json:"from_token_address"`
	ToTokenAddress      string    `json:"to_token_address"`
	SenderAddress       string    `json:"sender_address"`
	OriginSenderAddress string    `json:"origin_sender_address"`
	QuanlityIn          float64   `json:"quanlity_in"`
	QuanlityOut         float64   `json:"quanlity_out"`
	LogIndex            int       `json:"log_index"`
	ExchangeName        string    `json:"exchange_name"`
	Timestamp           time.Time `json:"timestamp"`
	PoolAddress         string    `json:"pool_address"`
	AmountUsd           float64   `json:"amount_usd"`
	Chain               string    `json:"chain"`
	Fee                 float64   `json:"fee"`
	NativePrice         float64   `json:"native_price"`
}
