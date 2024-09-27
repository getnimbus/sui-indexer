package format

import (
	"testing"

	"github.com/smartystreets/goconvey/convey"
)

func TestFormatAddress(t *testing.T) {
	convey.Convey("TestFormatAddress", t, func() {
		convey.So(FormatAddress("d13198771d2429cb7313f2387e597e98"), convey.ShouldEqual, "d13198...597e98")
		convey.So(FormatAddress("f85f679e-6827-450b-9b43-e85bc973c4ad"), convey.ShouldEqual, "f85f67...73c4ad")
		convey.So(FormatAddress("0xe943ca6F83E4585FB64c2118d36ac325e1bF149e"), convey.ShouldEqual, "0xe943...bF149e")
	})
}
