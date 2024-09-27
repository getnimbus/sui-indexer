package gorm_scope

type TokenScope struct {
	*base
}

func NewToken(b *base) *TokenScope {
	return &TokenScope{base: b}
}
