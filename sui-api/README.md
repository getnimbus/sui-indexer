# Sui REST API

This is open source API for query SUI data from Postgres indexer.

DEMO Endpoint: https://sui-oss-api.getnimbus.io
Document: https://sui-oss-api.getnimbus.io/api/docs/

## Install

    yarn install

## Run the app

    yarn run dev

# Supported API

We support to get:

- Tokens/NFTs holding of address
- Realtime tokens price feed
- Historical swap trades

## Get tokens holding of wallet address

### Request

`GET /api/v1/holding/tokens`

    curl -i -H 'Accept: application/json' https://sui-oss-api.getnimbus.io/api/v1/holding/tokens?address=0x02a212de6a9dfa3a69e22387acfbafbb1a9e591bd9d636e7895dcfc8de05f331

### Response

    HTTP/1.1 200 OK
    Date: Thu, 24 Feb 2011 12:36:30 GMT
    Status: 200 OK
    Connection: close
    Content-Type: application/json
    Content-Length: 2

```json
{
  "data": [
    {
      "owner": "0x02a212de6a9dfa3a69e22387acfbafbb1a9e591bd9d636e7895dcfc8de05f331",
      "token_decimals": 9,
      "token_name": "Sui",
      "token_symbol": "SUI",
      "token_address": "0x2::sui::SUI",
      "logo": "https://raw.githubusercontent.com/sonarwatch/token-lists/main/images/common/SUI.png",
      "balance": "4.89438742",
      "quote_rate": 1.699141408862965,
      "quote": 8.316256336339974
    }
  ]
}
```

## Get NFTs holding of wallet address

### Request

`GET /api/v1/holding/nfts`

    curl -i -H 'Accept: application/json' https://sui-oss-api.getnimbus.io/api/v1/holding/nfts?address=0x02a212de6a9dfa3a69e22387acfbafbb1a9e591bd9d636e7895dcfc8de05f331

### Response

    HTTP/1.1 200 OK
    Date: Thu, 24 Feb 2011 12:36:30 GMT
    Status: 200 OK
    Connection: close
    Content-Type: application/json
    Content-Length: 2

```json
{
  "data": [
    {
      "owner": "0x02a212de6a9dfa3a69e22387acfbafbb1a9e591bd9d636e7895dcfc8de05f331",
      "collection": {
        "description": "",
        "externalUrl": "",
        "id": "0xac176715abe5bcdaae627c5048958bbe320a8474f524674f3278e31af3c8b86b::fuddies::Fuddies",
        "imageUrl": "https://ipfs.io/ipfs/QmbobReGjW7vXECp22vkcUoAPD6q1C6YWZWi9punGD2Zp3",
        "name": "Fuddies ",
        "totalItems": 0,
        "chain": "SUI"
      },
      "collectionId": "0xac176715abe5bcdaae627c5048958bbe320a8474f524674f3278e31af3c8b86b::fuddies::Fuddies",
      "tokens": [
        {
          "objectId": "0xfc26f451365532e29dfad1a7c995097286b0c6708d4e165edc66c65fd834d368",
          "type": "0xac176715abe5bcdaae627c5048958bbe320a8474f524674f3278e31af3c8b86b::fuddies::Fuddies",
          "isLocked": false,
          "kioskId": "0x93a131b34c2ad51ec0e18bccc460ec455fcae9da3463b83f3ea9e6abf2ec5074",
          "data": {
            "objectId": "0xfc26f451365532e29dfad1a7c995097286b0c6708d4e165edc66c65fd834d368",
            "version": "1724732",
            "digest": "GWAyQuGnEw11AixsHJvmZ89hGLjhCsjDnZJsqkWWzx1A",
            "type": "0xac176715abe5bcdaae627c5048958bbe320a8474f524674f3278e31af3c8b86b::fuddies::Fuddies",
            "display": {
              "data": {
                "attributes": "\n  type: 0xbc3df36be17f27ac98e3c839b2589db8475fa07b20657b08e8891e3aaf5ee5f9::attributes::Attributes\n  map:   \n    type: 0x2::vec_map::VecMap<0x1::ascii::String, 0x1::ascii::String>\n    contents:   \n      type: 0x2::vec_map::Entry<0x1::ascii::String, 0x1::ascii::String>\n      key: Eyes\n      value: Water,\n    \n      type: 0x2::vec_map::Entry<0x1::ascii::String, 0x1::ascii::String>\n      key: Head\n      value: Graduation,\n    \n      type: 0x2::vec_map::Entry<0x1::ascii::String, 0x1::ascii::String>\n      key: Clothes\n      value: Pipe,\n    \n      type: 0x2::vec_map::Entry<0x1::ascii::String, 0x1::ascii::String>\n      key: Skin\n      value: Brown,\n    \n      type: 0x2::vec_map::Entry<0x1::ascii::String, 0x1::ascii::String>\n      key: Background\n      value: Lavender",
                "description": "10,000 extra special owls.",
                "image_url": "ipfs://QmbobReGjW7vXECp22vkcUoAPD6q1C6YWZWi9punGD2Zp3",
                "name": "Fuddies #9999",
                "tags": "[\"ProfilePicture\"]"
              },
              "error": null
            }
          },
          "version": "1724732",
          "digest": "GWAyQuGnEw11AixsHJvmZ89hGLjhCsjDnZJsqkWWzx1A",
          "display": {
            "data": {
              "attributes": "\n  type: 0xbc3df36be17f27ac98e3c839b2589db8475fa07b20657b08e8891e3aaf5ee5f9::attributes::Attributes\n  map:   \n    type: 0x2::vec_map::VecMap<0x1::ascii::String, 0x1::ascii::String>\n    contents:   \n      type: 0x2::vec_map::Entry<0x1::ascii::String, 0x1::ascii::String>\n      key: Eyes\n      value: Water,\n    \n      type: 0x2::vec_map::Entry<0x1::ascii::String, 0x1::ascii::String>\n      key: Head\n      value: Graduation,\n    \n      type: 0x2::vec_map::Entry<0x1::ascii::String, 0x1::ascii::String>\n      key: Clothes\n      value: Pipe,\n    \n      type: 0x2::vec_map::Entry<0x1::ascii::String, 0x1::ascii::String>\n      key: Skin\n      value: Brown,\n    \n      type: 0x2::vec_map::Entry<0x1::ascii::String, 0x1::ascii::String>\n      key: Background\n      value: Lavender",
              "description": "10,000 extra special owls.",
              "image_url": "ipfs://QmbobReGjW7vXECp22vkcUoAPD6q1C6YWZWi9punGD2Zp3",
              "name": "Fuddies #9999",
              "tags": "[\"ProfilePicture\"]"
            },
            "error": null
          },
          "royalty": 0,
          "imageUrl": "https://ipfs.io/ipfs/QmbobReGjW7vXECp22vkcUoAPD6q1C6YWZWi9punGD2Zp3",
          "tokenId": "9999",
          "contractAddress": "0xfc26f451365532e29dfad1a7c995097286b0c6708d4e165edc66c65fd834d368",
          "name": "Fuddies #9999",
          "rarityScore": 0,
          "rank": "N/A",
          "price": 0,
          "cost": 0
        }
      ],
      "floorPrice": 0,
      "marketPrice": 0
    }
  ]
}
```

## Realtime tokens price feed

### Request

`GET /api/v1/tokens`

    curl -i -H 'Accept: application/json' https://sui-oss-api.getnimbus.io/api/v1/tokens?limit=50&offset=0

### Response

    HTTP/1.1 200 OK
    Date: Thu, 24 Feb 2011 12:36:30 GMT
    Status: 200 OK
    Connection: close
    Content-Type: application/json
    Content-Length: 36

```json
{
  "data": [
    {
      "market_cap": "16717240158550892000",
      "price": "1.6717240158550892",
      "token_address": "0x2::sui::SUI",
      "token_symbol": "SUI",
      "token_name": "Sui",
      "token_decimals": "9",
      "chain": "SUI",
      "id": "a07ea8c4-82cf-444f-a838-8cf41c582adf",
      "created_at": "2024-02-05T05:00:42.654Z",
      "updated_at": "2024-02-22T10:54:27.276Z",
      "total_supply": "10000000000000000000",
      "logo": "https://raw.githubusercontent.com/sonarwatch/token-lists/main/images/common/SUI.png"
    }
  ]
}
```

`GET /api/v1/tokens/{address}`

    curl -i -H 'Accept: application/json' https://sui-oss-api.getnimbus.io/api/v1/tokens/0x2::sui::SUI

### Response

    HTTP/1.1 200 OK
    Date: Thu, 24 Feb 2011 12:36:30 GMT
    Status: 200 OK
    Connection: close
    Content-Type: application/json
    Content-Length: 36

```json
{
  "data": {
    "market_cap": "16717240158550892000",
    "price": "1.6717240158550892",
    "token_address": "0x2::sui::SUI",
    "token_symbol": "SUI",
    "token_name": "Sui",
    "token_decimals": "9",
    "chain": "SUI",
    "id": "a07ea8c4-82cf-444f-a838-8cf41c582adf",
    "created_at": "2024-02-05T05:00:42.654Z",
    "updated_at": "2024-02-22T10:54:27.276Z",
    "total_supply": "10000000000000000000",
    "logo": "https://raw.githubusercontent.com/sonarwatch/token-lists/main/images/common/SUI.png"
  }
}
```

## Get swap trades of wallet address

### Request

`GET /api/v1/trades`

    curl -i -H 'Accept: application/json' https://sui-oss-api.getnimbus.io/api/v1/trades?address=0x02a212de6a9dfa3a69e22387acfbafbb1a9e591bd9d636e7895dcfc8de05f331&limit=50&offset=0

### Response

    HTTP/1.1 404 Not Found
    Date: Thu, 24 Feb 2011 12:36:30 GMT
    Status: 404 Not Found
    Connection: close
    Content-Type: application/json
    Content-Length: 35

```json
{
  "data": [
    {
      "id": "c995d069-06d9-4cad-a101-b9c136df952b",
      "block": 26995500,
      "tx_hash": "4eknSgGsm68VoybK2ac9vNvVXPvppnRzMAunVi9ymmea",
      "from_token_address": "0x5d4b302506645c37ff133b98c4b50a5ae14841659738d6d733d59d0d217a93bf::coin::COIN",
      "to_token_address": "0x2::sui::SUI",
      "origin_sender_address": "0x02a212de6a9dfa3a69e22387acfbafbb1a9e591bd9d636e7895dcfc8de05f331",
      "quanlity_in": 4210.803377,
      "quanlity_out": 2500.909465774,
      "log_index": 0,
      "exchange_name": "CETUS",
      "timestamp": "2024-02-23T09:17:23.117Z",
      "pool_address": "0xcf994611fd4c48e277ce3ffd4d4364c914af2c3cbb05f7bf6facd371de688630",
      "amount_usd": 4209.461839519271,
      "chain": "SUI",
      "fee": 0.0578217732121819,
      "native_price": 1.675381547961669
    }
  ]
}
```
