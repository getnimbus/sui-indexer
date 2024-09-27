package util

import (
	"encoding/csv"
	"io"
	"log"
	"os"
)

func ReadCsv(file *os.File) <-chan []string {
	var (
		rows = make(chan []string)
		i    = 0
	)

	go func() {
		defer func() {
			close(rows)
			file.Close()
		}()

		parser := csv.NewReader(file)
		for {
			row, err := parser.Read()
			if err == io.EOF {
				break
			} else if err != nil {
				log.Fatal(err)
			} else if i == 0 { // skip header
				i++
				continue
			}
			rows <- row
		}
	}()

	return rows
}

func WriteCSV(headers []string, file *os.File, data <-chan []string) <-chan error {
	writer := csv.NewWriter(file)

	// write headers
	writer.Write(headers)
	writer.Flush()

	// write data
	errCh := make(chan error, 1)
	go func() {
		defer close(errCh)

		for rowData := range data {
			if err := writer.Write(rowData); err != nil {
				errCh <- err
				log.Printf("error writing csv: %v\n", err)
				return
			}
			writer.Flush()
		}

		// flush all remain in buffered
		writer.Flush()

		if err := writer.Error(); err != nil {
			errCh <- err
			log.Printf("error flushing csv: %v\n", err)
			return
		}
		log.Println("csv file created successfully")
	}()

	return errCh
}
