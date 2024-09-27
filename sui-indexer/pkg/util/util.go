package util

import (
	"crypto/hmac"
	"crypto/sha512"
	"encoding/hex"
	"net/url"
	"reflect"
	"strings"

	"github.com/google/uuid"
)

func IsNil(v interface{}) bool {
	if v == nil {
		return true
	}

	val := reflect.ValueOf(v)
	switch val.Kind() {
	case reflect.Chan, reflect.Func, reflect.Map, reflect.Pointer, reflect.UnsafePointer, reflect.Interface, reflect.Slice:
		return val.IsNil()
	}

	return false
}

func IsSlice(v interface{}) bool {
	return reflect.TypeOf(v).Kind() == reflect.Slice
}

func IsValidUUID(u string) bool {
	_, err := uuid.Parse(u)
	return err == nil
}

func Hmacsha512(message []byte, key []byte) string {
	hasher := hmac.New(sha512.New, key)
	hasher.Write(message)
	return hex.EncodeToString(hasher.Sum(nil))
}

func QuotePlus(input string) string {
	// URL-encode the string
	encoded := url.QueryEscape(input)

	// Replace %20 with +
	encoded = strings.Replace(encoded, "%20", "+", -1)

	return encoded
}
