package format

import (
	"fmt"
	"math/big"
	"strconv"

	"github.com/leekchan/accounting"
)

var (
	oneCent  = big.NewFloat(0.01)
	one      = big.NewFloat(1)
	million  = big.NewFloat(1000000)
	billion  = big.NewFloat(1000000000)
	trillion = big.NewFloat(1000000000000)
)

func FormatPrice(value *big.Float) string {
	ac := accounting.Accounting{Symbol: "$", Precision: 4}
	if value.Cmp(one) == -1 {
		return fmt.Sprintf("$%s", FormatSmallNumber(value, 4))
	} else {
		return ac.FormatMoneyBigFloat(value)
	}
}

func FormatMoney(value *big.Float) string {
	ac := accounting.Accounting{Symbol: "$", Precision: 2}
	if value.Cmp(trillion) >= 0 {
		return ac.FormatMoneyBigFloat(new(big.Float).Quo(value, trillion)) + "T"
	} else if value.Cmp(billion) >= 0 {
		return ac.FormatMoneyBigFloat(new(big.Float).Quo(value, billion)) + "B"
	} else if value.Cmp(million) >= 0 {
		return ac.FormatMoneyBigFloat(new(big.Float).Quo(value, million)) + "M"
	} else if value.Cmp(oneCent) == -1 {
		return "<$0.01"
	} else {
		return ac.FormatMoneyBigFloat(value)
	}
}

func FormatAmount(value *big.Float) string {
	if value.Cmp(trillion) >= 0 {
		return accounting.FormatNumberBigFloat(new(big.Float).Quo(value, trillion), 2, ",", ".") + "T"
	} else if value.Cmp(billion) >= 0 {
		return accounting.FormatNumberBigFloat(new(big.Float).Quo(value, billion), 2, ",", ".") + "B"
	} else if value.Cmp(million) >= 0 {
		return accounting.FormatNumberBigFloat(new(big.Float).Quo(value, million), 2, ",", ".") + "M"
	} else if value.Cmp(one) == -1 {
		return FormatSmallNumber(value, 4)
	} else {
		return accounting.FormatNumberBigFloat(value, 4, ",", ".")
	}
}

func FormatSmallNumber(value *big.Float, precision int) string {
	if value.Cmp(one) == -1 {
		var (
			number, _      = value.Float64()
			fixNumber      = 0
			isContinueZero = true
			newValue       = ""
		)
		for i, char := range strconv.FormatFloat(number, 'f', -1, 64) {
			if i < 2 {
				newValue += string(char)
			} else if char == '0' && isContinueZero {
				newValue += string(char)
			} else if fixNumber < precision {
				newValue += string(char)
				fixNumber += 1
				isContinueZero = false
			}
		}

		for i := 0; i < precision-fixNumber; i++ {
			newValue += "0"
		}

		return newValue
	}

	return fmt.Sprintf("%s", value.String())
}
