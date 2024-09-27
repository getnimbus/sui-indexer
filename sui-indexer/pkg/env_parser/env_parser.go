package env_parser

import (
	"os"
	"strconv"
	"strings"
)

func GetString(key string, defaultValue string) string {
	envValue := os.Getenv(key)
	if strings.TrimSpace(envValue) == "" {
		return defaultValue
	}
	return envValue
}

func GetInt(key string, defaultValue int64) int64 {
	envValue := os.Getenv(key)
	if strings.TrimSpace(envValue) == "" {
		return defaultValue
	}
	intValue, err := strconv.ParseInt(envValue, 10, 64)
	if err != nil {
		return defaultValue
	}
	return intValue
}

func GetArray(key string, separator string, defaultValue []string) []string {
	envValue := os.Getenv(key)
	if strings.TrimSpace(envValue) == "" {
		return defaultValue
	}
	return strings.Split(envValue, separator)
}

func IsDev() bool {
	return GetString("ENV", "") == "dev"
}

func IsProd() bool {
	return GetString("ENV", "") == "prod"
}
