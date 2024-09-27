.PHONY: default di clean build

default: di build;

di:
	wire ./cmd/sui-master
	wire ./cmd/sui-worker
	wire ./cmd/cli
	wire ./cmd/backfill-indexer

clean:
	rm -rf ./out

build:
	go build -o out/sui-master ./cmd/sui-master
	go build -o out/sui-worker ./cmd/sui-worker
	go build -o out/cli ./cmd/cli
	go build -o out/cli ./cmd/backfill-indexer

install:
	go install ./cmd/sui-master
	go install ./cmd/sui-worker
	go install ./cmd/cli
	go install ./cmd/backfill-indexer

static:
	CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -a -installsuffix cgo -o ./out/sui-master ./cmd/sui-master
	CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -a -installsuffix cgo -o ./out/sui-worker ./cmd/sui-worker
	CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -a -installsuffix cgo -o ./out/cli ./cmd/cli
	CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -a -installsuffix cgo -o ./out/backfill-indexer ./cmd/backfill-indexer
