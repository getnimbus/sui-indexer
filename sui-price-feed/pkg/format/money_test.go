package format

import (
	"math/big"
	"testing"

	"github.com/smartystreets/goconvey/convey"
)

func TestFormatMoney(t *testing.T) {
	convey.Convey("TestFormatMoney", t, func() {
		// normal
		convey.So(FormatPrice(big.NewFloat(0.13044287)), convey.ShouldEqual, "$0.1304")
		convey.So(FormatAmount(big.NewFloat(170554.292519)), convey.ShouldEqual, "170,554.2925")
		convey.So(FormatMoney(big.NewFloat(22247.591406997886)), convey.ShouldEqual, "$22,247.59")

		// test million
		convey.So(FormatPrice(big.NewFloat(0.00000114)), convey.ShouldEqual, "$0.000001140")
		convey.So(FormatAmount(big.NewFloat(13428990.6597)), convey.ShouldEqual, "13.43M")
		convey.So(FormatMoney(big.NewFloat(15309.049638152059)), convey.ShouldEqual, "$15,309.05")

		// test billion
		convey.So(FormatPrice(big.NewFloat(0.00000114)), convey.ShouldEqual, "$0.000001140")
		convey.So(FormatAmount(big.NewFloat(13428990910.6597)), convey.ShouldEqual, "13.43B")
		convey.So(FormatMoney(big.NewFloat(15309.049638152059)), convey.ShouldEqual, "$15,309.05")

		// < 10 cents
		convey.So(FormatPrice(big.NewFloat(36235.035)), convey.ShouldEqual, "$36,235.0350")
		convey.So(FormatAmount(big.NewFloat(0.65361198)), convey.ShouldEqual, "0.6536")
		convey.So(FormatMoney(big.NewFloat(1340.7896803433161)), convey.ShouldEqual, "$1,340.79")

		// < 1 cent
		convey.So(FormatPrice(big.NewFloat(31.951178)), convey.ShouldEqual, "$31.9512")
		convey.So(FormatAmount(big.NewFloat(0.000868)), convey.ShouldEqual, "0.0008680")
		convey.So(FormatMoney(big.NewFloat(0.000868)), convey.ShouldEqual, "<$0.01")
	})
}
