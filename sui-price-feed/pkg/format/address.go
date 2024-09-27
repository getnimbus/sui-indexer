package format

func FormatAddress(value string) string {
	if len(value) >= 20 {
		return value[:6] + "..." + value[len(value)-6:]
	}
	return value
}
