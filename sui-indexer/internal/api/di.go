package api

import (
	"github.com/getnimbus/ultrago/u_handler"
	"github.com/google/wire"
)

var GraphSet = wire.NewSet(
	u_handler.NewBaseHandler,
	NewHealthcheckHandler,
)
