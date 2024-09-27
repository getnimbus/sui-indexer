package service

import (
	"context"
	"encoding/csv"
	"fmt"
	"io"
	"math/big"
	"net/url"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/service/s3"
	"github.com/getnimbus/ultrago/u_logger"
	"github.com/golang-module/carbon/v2"
	"github.com/samber/lo"

	"feng-sui-core/internal/entity"
	"feng-sui-core/internal/repo"
	"feng-sui-core/pkg/caching"
)

func NewSyncTradeService(
	tradeRepo repo.TradeRepo,
	tokenRepo repo.TokenRepo,
	s3Service S3Service,
) (SyncTradeService, error) {
	return &syncTradeService{
		tradeRepo: tradeRepo,
		tokenRepo: tokenRepo,
		s3Service: s3Service,
	}, nil
}

type syncTradeService struct {
	tradeRepo repo.TradeRepo
	tokenRepo repo.TokenRepo
	s3Service S3Service
}

type SyncTradeService interface {
	SyncTradesFromCsv(ctx context.Context, path string) error
	SyncTradesFromS3(ctx context.Context, uri string) error
}

func (svc *syncTradeService) SyncTradesFromCsv(ctx context.Context, path string) error {
	ctx, logger := u_logger.GetLogger(ctx)

	file, err := os.Open(path)
	if err != nil {
		return err
	}
	logger.Infof("start sync trades from file path: %s", path)
	defer file.Close()

	reader := csv.NewReader(file)
	headers, err := reader.Read() // Read the header row
	if err != nil {
		return err
	}

	// Read CSV file line by line
	var (
		i      = 0
		trades = make([]*entity.Trade, 0)
	)
	for {
		// Read line
		record, err := reader.Read()
		if err != nil {
			if err == csv.ErrFieldCount {
				continue // Skip malformed line
			}
			break
		}

		logger.Debug(record)
		// save to db
		ts, _ := time.ParseInLocation(time.DateTime, getRecordValue(record, headers, "timestamp"), time.UTC)
		trades = append(trades, &entity.Trade{
			Block:               int64(parseToInt(getRecordValue(record, headers, "block"))),
			TxHash:              getRecordValue(record, headers, "tx_hash"),
			FromTokenAddress:    getRecordValue(record, headers, "from_token_address"),
			ToTokenAddress:      getRecordValue(record, headers, "to_token_address"),
			SenderAddress:       getRecordValue(record, headers, "sender_address"),
			OriginSenderAddress: getRecordValue(record, headers, "origin_sender_address"),
			QuanlityIn:          parseToFloat64(getRecordValue(record, headers, "quanlity_in")),
			QuanlityOut:         parseToFloat64(getRecordValue(record, headers, "quanlity_out")),
			LogIndex:            parseToInt(getRecordValue(record, headers, "log_index")),
			ExchangeName:        getRecordValue(record, headers, "exchange_name"),
			Timestamp:           ts,
			PoolAddress:         getRecordValue(record, headers, "pool_address"),
			AmountUsd:           parseToFloat64(getRecordValue(record, headers, "amount_usd")),
			Chain:               getRecordValue(record, headers, "chain"),
			Fee:                 parseToFloat64(getRecordValue(record, headers, "fee")),
			NativePrice:         parseToFloat64(getRecordValue(record, headers, "native_price")),
		})
		if i%1000 == 0 {
			if err := svc.tradeRepo.CreateMany(ctx, trades...); err != nil {
				return err
			}
			logger.Infof("saved %d trades", i)
			trades = make([]*entity.Trade, 0)
		}
		i++
	}

	// save the remaining trades
	if err := svc.tradeRepo.CreateMany(ctx, trades...); err != nil {
		return err
	}
	logger.Infof("saved %d trades", i)
	return nil
}

// Docs: https://aws.amazon.com/blogs/developer/introducing-support-for-amazon-s3-select-in-the-aws-sdk-for-go/
func (svc *syncTradeService) SyncTradesFromS3(ctx context.Context, uri string) error {
	ctx, logger := u_logger.GetLogger(ctx)

	u, err := url.Parse(uri)
	if err != nil {
		return err
	}
	logger.Infof("start sync trades from s3 uri: %s", uri)

	resp, err := svc.s3Service.GetClient().ListObjects(&s3.ListObjectsInput{
		Bucket: aws.String(u.Host),
		Prefix: aws.String(strings.Replace(u.Path, "/", "", 1)),
	})
	if err != nil {
		return err
	}

	for _, object := range resp.Contents {
		// TODO: change headers to match the csv file
		headers := []string{"block", "tx_hash", "from_token_address", "to_token_address", "sender_address", "origin_sender_address", "quanlity_in", "quanlity_out", "log_index", "exchange_name", "timestamp", "pool_address", "amount_usd", "chain", "fee", "native_price"}

		params := &s3.SelectObjectContentInput{
			Bucket:         aws.String(u.Host),
			Key:            aws.String(*object.Key),
			ExpressionType: aws.String(s3.ExpressionTypeSql),
			Expression:     aws.String("SELECT * FROM S3Object"),
			InputSerialization: &s3.InputSerialization{
				CSV: &s3.CSVInput{
					//FileHeaderInfo: aws.String(s3.FileHeaderInfoUse),
					FileHeaderInfo: aws.String(s3.FileHeaderInfoNone),
				},
				CompressionType: aws.String(s3.CompressionTypeGzip),
				//CompressionType: aws.String(s3.CompressionTypeNone),
			},
			OutputSerialization: &s3.OutputSerialization{
				CSV: &s3.CSVOutput{},
			},
		}

		resp, err := svc.s3Service.GetClient().SelectObjectContent(params)
		if err != nil {
			return err
		}
		defer resp.EventStream.Close()

		results, resultWriter := io.Pipe()
		go func() {
			defer resultWriter.Close()
			for event := range resp.EventStream.Events() {
				switch e := event.(type) {
				case *s3.RecordsEvent:
					resultWriter.Write(e.Payload)
				}
			}
		}()

		var (
			i      = 0
			trades = make([]*entity.Trade, 0)
		)
		// Read CSV stream
		resReader := csv.NewReader(results)
		for {
			record, err := resReader.Read()
			if err == io.EOF {
				break
			}

			logger.Debug(record)
			// save to db
			fromTokenAddress := getRecordValue(record, headers, "from_token_address")
			if fromTokenAddress != "" {
				fromTokenAddress = "0x" + fromTokenAddress
			}
			toTokenAddress := getRecordValue(record, headers, "to_token_address")
			if toTokenAddress != "" {
				toTokenAddress = "0x" + toTokenAddress
			}
			ts, _ := strconv.ParseInt(getRecordValue(record, headers, "timestamp"), 10, 64)
			trades = append(trades, &entity.Trade{
				Block:               int64(parseToInt(getRecordValue(record, headers, "block"))),
				TxHash:              getRecordValue(record, headers, "tx_hash"),
				FromTokenAddress:    fromTokenAddress,
				ToTokenAddress:      toTokenAddress,
				SenderAddress:       getRecordValue(record, headers, "sender_address"),
				OriginSenderAddress: getRecordValue(record, headers, "origin_sender_address"),
				QuanlityIn:          formatUnits(getRecordValue(record, headers, "quanlity_in"), svc.getTokenDecimals(ctx, fromTokenAddress)),
				QuanlityOut:         formatUnits(getRecordValue(record, headers, "quanlity_out"), svc.getTokenDecimals(ctx, toTokenAddress)),
				LogIndex:            parseToInt(getRecordValue(record, headers, "log_index")),
				ExchangeName:        getRecordValue(record, headers, "exchange_name"),
				Timestamp:           carbon.CreateFromTimestampMilli(ts, carbon.UTC).ToStdTime(),
				PoolAddress:         getRecordValue(record, headers, "pool_address"),
				AmountUsd:           parseToFloat64(getRecordValue(record, headers, "amount_usd")),
				Chain:               getRecordValue(record, headers, "chain"),
				Fee:                 parseToFloat64(getRecordValue(record, headers, "fee")),
				NativePrice:         parseToFloat64(getRecordValue(record, headers, "native_price")),
			})
			if i%1000 == 0 {
				if err := svc.tradeRepo.CreateMany(ctx, trades...); err != nil {
					return err
				}
				logger.Infof("saved %d trades", i)
				trades = make([]*entity.Trade, 0)
			}
			i++
		}

		// save the remaining trades
		if err := svc.tradeRepo.CreateMany(ctx, trades...); err != nil {
			return err
		}
		logger.Infof("saved %d trades", i)

		if err := resp.EventStream.Err(); err != nil {
			return fmt.Errorf("failed to read from SelectObjectContent EventStream, %v", err)
		}
	}
	return nil
}

func (svc *syncTradeService) getTokenDecimals(ctx context.Context, tokenAddress string) int {
	tokens, err, _ := caching.MemoizeFunc("tokens", nil, func() (interface{}, error) {
		tokens, err := svc.tokenRepo.GetList(ctx,
			svc.tokenRepo.S().ColumnEqual("chain", "SUI"),
		)
		if err != nil {
			return nil, err
		}
		tokensMap := lo.Associate(tokens, func(token *entity.Token) (string, *entity.Token) {
			return token.TokenAddress, token
		})
		return tokensMap, nil
	})
	if err != nil {
		return 0
	}
	token, ok := tokens.(map[string]*entity.Token)[tokenAddress]
	if !ok {
		return 0
	}
	return token.TokenDecimals
}

func formatUnits(number string, decimals int) float64 {
	num, ok := new(big.Float).SetString(number)
	if !ok {
		return parseToFloat64(number)
	}
	dec := new(big.Float).SetInt(new(big.Int).Exp(big.NewInt(10), big.NewInt(int64(decimals)), nil))
	res, _ := new(big.Float).Quo(num, dec).Float64()
	return res
}

// Helper functions to parse strings to respective types
func parseToInt(s string) int {
	v, err := strconv.Atoi(s)
	if err != nil {
		return 0 // or handle the error as required
	}
	return v
}

func parseToFloat64(s string) float64 {
	v, err := strconv.ParseFloat(s, 64)
	if err != nil {
		return 0.0 // or handle the error as required
	}
	return v
}

func parseToBool(s string) bool {
	v, err := strconv.ParseBool(s)
	if err != nil {
		return false // or handle the error as required
	}
	return v
}

// getRecordValue gets the value of a record or returns an empty string if not found
func getRecordValue(record []string, headers []string, name string) string {
	index, err := findIndex(headers, name)
	if err != nil {
		return ""
	}
	str := strings.Trim(record[index], " ")
	//fmt.Println("Index:", index, "Value:", record[index], name)
	return str
}

// findIndex finds the index of a column name in the headers, returns an error if not found
func findIndex(headers []string, name string) (int, error) {
	for i, header := range headers {
		if header == name {
			return i, nil
		}
	}
	return -1, fmt.Errorf("Column '%s' not found in headers", name)
}
