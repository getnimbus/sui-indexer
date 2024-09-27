package sui_model

import (
	"github.com/coming-chat/go-sui/v2/sui_types"
)

type Object struct {
	sui_types.Object
	DateKey string `json:"dateKey"`
}

func (o *Object) PartitionKey() string {
	return o.Owner.AddressOwner.String()
}
