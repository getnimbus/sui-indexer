package bloom

import (
	"fmt"
	"testing"

	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/crypto"
)

func TestBloom(t *testing.T) {
	positive := []string{
		"testtest",
		"test",
		"hallo",
		"other",
	}
	negative := []string{
		"tes",
		"lo",
	}

	var bloom Bloom
	for _, data := range positive {
		bloom.Add([]byte(data))
	}

	for _, data := range positive {
		if !bloom.Test([]byte(data)) {
			t.Error("expected", data, "to test true")
		}
	}
	for _, data := range negative {
		if bloom.Test([]byte(data)) {
			t.Error("did not expect", data, "to test true")
		}
	}
}

// TestBloomExtensively does some more thorough tests
func TestBloomExtensively(t *testing.T) {
	var exp = common.HexToHash("c8d3ca65cdb4874300a9e39475508f23ed6da09fdbc487f89a2dcf50b09eb263")
	var b Bloom
	// Add 100 "random" things
	for i := 0; i < 100; i++ {
		data := fmt.Sprintf("xxxxxxxxxx data %d yyyyyyyyyyyyyy", i)
		b.Add([]byte(data))
		//b.Add(new(big.Int).SetBytes([]byte(data)))
	}
	got := crypto.Keccak256Hash(b.Bytes())
	if got != exp {
		t.Errorf("Got %x, exp %x", got, exp)
	}
	var b2 Bloom
	b2.SetBytes(b.Bytes())
	got2 := crypto.Keccak256Hash(b2.Bytes())
	if got != got2 {
		t.Errorf("Got %x, exp %x", got, got2)
	}
}

func BenchmarkBloom9(b *testing.B) {
	test := []byte("testestestest")
	for i := 0; i < b.N; i++ {
		Bloom9(test)
	}
}

func BenchmarkBloom9Lookup(b *testing.B) {
	toTest := []byte("testtest")
	bloom := new(Bloom)
	for i := 0; i < b.N; i++ {
		bloom.Test(toTest)
	}
}
