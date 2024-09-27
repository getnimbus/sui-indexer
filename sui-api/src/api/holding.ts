import express from "express";
import { prisma } from "@services/db";
import { suiClient, kioskClient } from "@services/client";
import { valueConvert } from "@utils/index";
import { groupBy } from "lodash";

/**
 * @swagger
 * components:
 *   schemas:
 *     TokenHolding:
 *        type: object
 *        properties:
 *          owner:
 *            type: string
 *            description: wallet address owner
 *          token_name:
 *            type: string
 *            description: The token name
 *          token_symbol:
 *            type: string
 *            description: The token symbol
 *          token_address:
 *            type: string
 *            description: The token address
 *          token_decimals:
 *            type: string
 *            description: The token decimals
 *          logo:
 *            type: string
 *            description: The logo of the token
 *          balance:
 *            type: number
 *            description: The token amount holding
 *          quote_rate:
 *            type: number
 *            description: The token quote rate
 *          quote:
 *            type: number
 *            description: balance * quote_rate
 *        example:
 *          owner: "0x02a212de6a9dfa3a69e22387acfbafbb1a9e591bd9d636e7895dcfc8de05f331"
 *          token_decimals: 9
 *          token_name: "Sui"
 *          token_symbol: "SUI"
 *          token_address: "0x2::sui::SUI"
 *          logo: "https://raw.githubusercontent.com/sonarwatch/token-lists/main/images/common/SUI.png"
 *          balance: 4.89438742
 *          quote_rate: 1.699141408862965
 *          quote: 8.316256336339974
 *     NFTHolding:
 *        type: object
 *        properties:
 *          owner:
 *            type: string
 *            description: wallet address owner
 *          collection:
 *            type: object
 *            properties:
 *                description:
 *                  type: string
 *                  description: The collection description
 *                externalUrl:
 *                  type: string
 *                  description: The collection external url
 *                id:
 *                  type: string
 *                  description: The collection id
 *                imageUrl:
 *                  type: string
 *                  description: The collection image url
 *                name:
 *                  type: string
 *                  description: The collection name
 *                totalItems:
 *                  type: number
 *                  description: Total items of collection that user holding
 *                chain:
 *                  type: string
 *                  description: The chain the collection is on
 *          collectionId:
 *            type: string
 *            description: The collection id
 *          tokens:
 *            type: array
 *            items:
 *                type: object
 *                properties:
 *                  objectId:
 *                    type: string
 *                    description: The object id
 *                  type:
 *                    type: string
 *                    description: The object type
 *                  isLocked:
 *                    type: boolean
 *                    description: The object is locked
 *                  kioskId:
 *                    type: string
 *                    description: The kiosk id
 *                  display:
 *                    type: object
 *                    properties:
 *                      data:
 *                        type: object
 *                        properties:
 *                          attributes:
 *                            type: string
 *                          description:
 *                            type: string
 *                          image_url:
 *                            type: string
 *                          name:
 *                            type: string
 *                          tags:
 *                            type: string
 *                royalty:
 *                  type: number
 *                  description: The royalty of the token
 *                imageUrl:
 *                  type: string
 *                  description: The image url of the token
 *                tokenId:
 *                  type: string
 *                  description: The token id
 *                contractAddress:
 *                  type: string
 *                  description: The contract address of the token
 *                name:
 *                  type: string
 *                  description: The name of the token
 *                rarityScore:
 *                  type: number
 *                  description: The rarity score of the token
 *                rank:
 *                  type: string
 *                  description: The rank of the token
 *                price:
 *                  type: number
 *                  description: The price of the token
 *                cost:
 *                  type: number
 *                  description: The cost of the token
 *          floorPrice:
 *            type: number
 *            description: The floor price of the collection
 *          marketPrice:
 *            type: number
 *            description: The market price of the collection
 */

/**
 * @swagger
 * tags:
 *   name: Accounts
 *   description: Account assets
 * /v1/holding:
 *   get:
 *     summary: Lists all the tokens holding of wallet address
 *     tags: [Accounts]
 *     parameters:
 *      - in: query
 *        required: true
 *        name: address
 *        schema:
 *          type: string
 *        description: User wallet address
 *     responses:
 *       200:
 *         description: List tokens holding of wallet address
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/TokenHolding'
 *       404:
 *         description: Address was not found
 * /v1/nfts:
 *   get:
 *     summary: Lists all the nfts holding of wallet address
 *     tags: [Accounts]
 *     parameters:
 *      - in: query
 *        required: true
 *        name: address
 *        schema:
 *          type: string
 *        description: User wallet address
 *     responses:
 *       200:
 *         description: List nfts holding of wallet address
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/NFTHolding'
 *       404:
 *         description: Address was not found
 */

const router = express.Router();

// tokens holding api
router.get("/tokens", async (req, res) => {
  try {
    const owner = String(req.query?.address || "");
    if (!owner) {
      return res.status(400).json({ message: "Address is required" });
    }

    const holding = await getTokenHolding(owner);

    return res.status(200).json({ data: holding });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

// nfts holding api
router.get("/nfts", async (req, res) => {
  try {
    const owner = String(req.query?.address || "");
    if (!owner) {
      return res.status(400).json({ message: "Address is required" });
    }

    const holding = await getHoldingNFT(owner);

    return res.status(200).json({ data: holding });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

const getTokenHolding = async (owner: string) => {
  let cursor = null;
  let holding: any[] = [];
  while (true) {
    const data = await suiClient.getAllCoins({
      owner: owner,
      cursor: cursor,
      limit: 10,
    });
    if (data.data.length === 0) {
      break;
    }

    const tokens = await Promise.all(
      data.data.map(async (item) => {
        const [tokenInfo, tokenPrice] = await Promise.all([
          prisma.tokens.findUnique({
            where: {
              chain_token_address: {
                token_address: item.coinType,
                chain: "SUI",
              },
            },
          }),
          prisma.price_feeds.findMany({
            where: {
              token_address: item.coinType,
              chain: "SUI",
            },
            orderBy: {
              timestamp: "desc",
            },
            take: 1,
          }),
        ]);

        const balance = valueConvert(
          item.balance,
          tokenInfo?.token_decimals || 0
        );
        const quoteRate = Number(tokenPrice?.[0]?.price) || 0;

        return {
          owner: owner,
          token_decimals: tokenInfo?.token_decimals,
          token_name: tokenInfo?.token_name || "N/A",
          token_symbol: tokenInfo?.token_symbol || "N/A",
          token_address: tokenInfo?.token_address || "N/A",
          logo:
            item.coinType === "0x2::sui::SUI"
              ? "https://raw.githubusercontent.com/sonarwatch/token-lists/main/images/common/SUI.png"
              : tokenInfo?.logo,
          balance: balance,
          quote_rate: quoteRate,
          quote: Number(balance) * quoteRate,
        };
      })
    );

    holding.push(...tokens);

    if (!data.hasNextPage) {
      break;
    }
    cursor = data.nextCursor;
  }

  return holding;
};

const getHoldingNFT = async (owner: string) => {
  // TODO: Support query paginatated
  const [kiosk, ownedObject, nativeTokenPrice] = await Promise.all([
    suiClient
      .getOwnedObjects({
        owner,
        filter: {
          MatchAny: [
            {
              StructType: "0x2::kiosk::KioskOwnerCap",
            },
            {
              StructType:
                "0x95a441d389b07437d00dd07e0b6f05f513d7659b13fd7c5d3923c7d9d847199b::ob_kiosk::OwnerToken",
            },
          ],
        },
        options: {
          showDisplay: true,
          showType: true,
          showContent: true,
        },
      })
      .then((data) => data.data),
    suiClient
      .getOwnedObjects({
        owner,
        filter: {
          MatchNone: [
            {
              StructType: "0x2::coin::Coin",
            },
            {
              StructType: "0x2::kiosk::KioskOwnerCap",
            },
            {
              StructType:
                "0x95a441d389b07437d00dd07e0b6f05f513d7659b13fd7c5d3923c7d9d847199b::ob_kiosk::OwnerToken",
            },
          ],
        },
        options: {
          showDisplay: true,
          showType: true,
          // showContent: true,
        },
      })
      .then((data) => data.data),
    prisma.price_feeds.findMany({
      where: {
        token_address: "0x2::sui::SUI",
        chain: "SUI",
      },
      orderBy: {
        timestamp: "desc",
      },
      take: 1,
    }),
  ]);

  const nftInsideKiosk = await Promise.all(
    kiosk.map((item) =>
      kioskClient
        .getKiosk({
          id:
            item.data?.content?.fields?.for ||
            item.data?.content?.fields?.kiosk,
          options: {
            withObjects: true,
            objectOptions: {
              showDisplay: true,
              showContent: false,
              showType: true,
            },
            withKioskFields: true, // this flag also returns the `kiosk` object in the response, which includes the base setup
            withListingPrices: true, // This flag enables / disables the fetching of the listing prices.
          },
        })
        .then((data) => data.items)
    )
  );

  const nftsKiosk = nftInsideKiosk.flat().map((item) => {
    return {
      ...item,
      ...item.data,
    };
  });

  // console.log(ownedObject.map((item) => item.data));
  const nftObjects = ownedObject
    .filter((item) => item.data?.display?.data?.image_url)
    .map((item) => item.data);

  const nfts = [...nftsKiosk, ...nftObjects];

  const nftsByCollection = groupBy(nfts, (item) => item?.type);

  // Query via https://suiscan.xyz/api/sui-backend/mainnet/api/collections/0xac176715abe5bcdaae627c5048958bbe320a8474f524674f3278e31af3c8b86b::fuddies::Fuddies
  // const collectionInfo = await suiClient.multiGetObjects({
  //   ids: Object.keys(nftsByCollection),
  //   options: {
  //     showDisplay: true,
  //   },
  // });

  return Object.keys(nftsByCollection).map((collection) => {
    const floorPrice = 0; // TODO:
    const tokens = nftsByCollection[collection].map((item) => {
      let imgUrl = item?.display?.data?.image_url || "";
      if (imgUrl.startsWith("ipfs://")) {
        imgUrl = imgUrl.replace("ipfs://", "https://ipfs.io/ipfs/"); // https://ipfs.io/ipfs/QmXxbJJxDadKJD1BmfG4Ak2yrf5SnSQNrVh6571ensXQBf
      }
      const name = item?.display?.data?.name || "";
      return {
        ...item,
        royalty: 0, // TODO: this api not have royalty
        imageUrl: imgUrl,
        tokenId: name.split("#")?.[1] || "", // TODO:
        contractAddress: item?.objectId,
        name: name,
        rarityScore: 0,
        rank: "N/A",
        price: floorPrice,
        cost: 0, // TODO:
      };
    });

    return {
      owner,
      collection: {
        description: "",
        externalUrl: "",
        id: collection,
        imageUrl: tokens[0]?.imageUrl || "",
        name: tokens[0]?.name?.split("#")?.[0] || "",
        totalItems: 0, // TODO: Collection total times
        chain: "SUI",
      },
      collectionId: collection,
      tokens,
      floorPrice,
      marketPrice: floorPrice * (nativeTokenPrice?.[0]?.price || 0),
    };
  });
};

export default router;
