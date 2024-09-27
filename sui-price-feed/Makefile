.PHONY: default di clean build

default: di build;

di:
	go run github.com/google/wire/cmd/wire ./cmd/price_feed

clean:
	rm -rf ./out

build:
	go build -o out/price_feed ./cmd/price_feed

install:
	go install ./cmd/price_feed

static:
	CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -a -installsuffix cgo -o ./out/price_feed ./cmd/price_feed
