import express from "express";
import { prisma } from "@services/db";
import { suiClient } from "@services/client";
import { normalizedTokenAddress } from "@utils/index";

/**
 * @swagger
 * components:
 *   schemas:
 *     Token:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           description: unique id of the token
 *         token_address:
 *           type: string
 *           description: The token address
 *         token_symbol:
 *           type: string
 *           description: The token symbol
 *         token_name:
 *           type: string
 *           description: The token name
 *         token_decimals:
 *           type: string
 *           description: The token decimals
 *         total_supply:
 *           type: string
 *           description: The total supply of the token
 *         logo:
 *           type: string
 *           description: The logo of the token
 *         chain:
 *           type: string
 *           description: The chain the token is on
 *         price:
 *           type: string
 *           description: The current price of the token
 *         market_cap:
 *           type: string
 *           description: The market cap of the token
 *         created_at:
 *           type: string
 *           format: date
 *           description: The date the token was created
 *         updated_at:
 *           type: string
 *           format: date
 *           description: The date the token was last updated
 *       example:
 *         id: "a07ea8c4-82cf-444f-a838-8cf41c582adf"
 *         token_address: "0x2::sui::SUI"
 *         token_symbol: "SUI"
 *         token_name: "Sui"
 *         token_decimals: "9"
 *         total_supply: "10000000000000000000"
 *         logo: "https://raw.githubusercontent.com/sonarwatch/token-lists/main/images/common/SUI.png"
 *         chain: "SUI"
 *         price: "1.6717240158550892"
 *         market_cap: "16717240158550892000"
 *         created_at: "2024-02-05T05:00:42.654Z"
 *         updated_at: "2024-02-22T10:54:27.276Z"
 */

/**
 * @swagger
 * tags:
 *   name: Tokens
 *   description: Tokens info API
 * /v1/tokens:
 *   get:
 *     summary: Lists all the tokens price
 *     tags: [Tokens]
 *     responses:
 *       200:
 *         description: The list of tokens price
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: "#/components/schemas/Token"
 * /v1/tokens/{address}:
 *   get:
 *     summary: Get token price by address
 *     tags: [Tokens]
 *     parameters:
 *       - in: path
 *         name: address
 *         schema:
 *           type: string
 *         required: true
 *         description: Token address
 *     responses:
 *       200:
 *         description: Token response
 *         content:
 *           application/json:
 *             schema:
 *               items:
 *                 $ref: "#/components/schemas/Token"
 *       404:
 *         description: Token was not found
 */

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    let offset = Number(req.query?.offset) || 0;
    let limit = Number(req.query?.limit) || 50;
    if (limit > 50) {
      limit = 50;
    }
    if (offset < 0) {
      offset = 0;
    }

    const endTime = getCurrentEpochStart();
    console.log("endTime", endTime);

    const tokens = (await prisma.$queryRaw`SELECT
      COALESCE(t1.total_supply, 0) * t2.price AS market_cap,
      t2.price,
      t1.*
    FROM tokens t1
    INNER JOIN price_feeds t2 ON t1.token_address = t2.token_address AND t1.chain = t2.chain
    WHERE t1.chain = 'SUI' AND t2.timestamp BETWEEN ${
      endTime - 300000
    } AND ${endTime}
    ORDER BY 1 DESC
    LIMIT ${limit} OFFSET ${offset};`) as any[]; // query from 1 days ago to now

    for (let i = 0; i < tokens.length; i++) {
      if (!tokens[i]?.total_supply) {
        try {
          const totalSupply = await suiClient.getTotalSupply({
            coinType: tokens[i].token_address,
          });

          if (totalSupply.value) {
            await prisma.tokens.update({
              where: {
                chain_token_address: {
                  token_address: tokens[i].token_address,
                  chain: "SUI",
                },
              },
              data: {
                total_supply: Number(totalSupply.value),
              },
            });
          }
          tokens[i].total_supply = Number(totalSupply.value || 0);
          tokens[i].market_cap =
            tokens[i].total_supply * Number(tokens[i].price || 0);
        } catch (err) {
          console.error(err);
        }
      }
    }

    return res.status(200).json({ data: tokens });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/:address", async (req, res) => {
  try {
    const tokenAddress = req.params.address;
    if (!tokenAddress) {
      return res.status(400).json({ message: "Token address is required" });
    }

    const token = (await prisma.$queryRaw`SELECT
      COALESCE(t2.total_supply, 0) * t1.price AS market_cap,
      t1.price,
      t2.*
    FROM price_feeds t1
    INNER JOIN tokens t2 ON t1.token_address = t2.token_address AND t1.chain = t2.chain
    WHERE t2.chain = 'SUI' AND t2.token_address = ${normalizedTokenAddress(
      tokenAddress
    )}
    ORDER BY t1.timestamp DESC
    LIMIT 1;`) as any[];

    if (token.length == 0) {
      return res.status(404).json({ message: "Token not found" });
    }

    return res.status(200).json({ data: token[0] });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

// TODO: Sync coin metadata to DB from Sui API
// router.get("/sync", async (req, res) => {
//   try {
//     let page = 0;
//     while (true) {
//       console.log("Page", page);

//       const data = await axios
//         .get(
//           `https://suiscan.xyz/api/sui-backend/mainnet/api/coins?page=${page}&sortBy=HOLDERS&orderBy=DESC&searchStr=&size=100`
//         )
//         .then((res) => res.data);

//       if (data?.content?.length == 0) {
//         break;
//       }

//       for (let i = 0; i < data.content.length; i++) {
//         const token = data.content[i];
//         const tokenAddress = normalizedTokenAddress(token.type);
//         if (token?.iconUrl) {
//           await prisma.tokens.upsert({
//             where: {
//               chain_token_address: {
//                 token_address: tokenAddress,
//                 chain: "SUI",
//               },
//             },
//             create: {
//               chain: "SUI",
//               token_address: tokenAddress,
//               token_name: token.name,
//               token_symbol: token.symbol,
//               token_decimals: token.decimals,
//               total_supply: token.supply,
//               logo: token.iconUrl,
//             },
//             update: {
//               token_name: token.name,
//               logo: token.iconUrl,
//               total_supply: token.supply,
//             },
//           });

//           console.log("Updated logo for", tokenAddress);
//         }
//       }

//       page++;
//     }
//     return res.status(200);
//   } catch (err) {
//     console.error(err);
//     return res.status(500).json({ message: "Internal server error" });
//   }
// });

function getCurrentEpochStart() {
  let currentTime = new Date();
  let epochStart = new Date(currentTime);

  // Set seconds and milliseconds to 0
  epochStart.setSeconds(0);
  epochStart.setMilliseconds(0);

  // Round down the minutes to the nearest multiple of 5
  epochStart.setMinutes(Math.floor(epochStart.getMinutes() / 5) * 5);

  return epochStart.getTime();
}

export default router;
