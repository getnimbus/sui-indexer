import express from "express";
import { prisma } from "@services/db";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
dayjs.extend(utc)

/**
 * @swagger
 * components:
 *   schemas:
 *     Trade:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           description: unique id of the trade
 *         block:
 *           type: string
 *           description: The checkpoint sequence of the trade
 *         tx_hash:
 *           type: string
 *           description: The transaction digest
 *         from_token_address:
 *           type: string
 *           description: The token address trade from
 *         to_token_address:
 *           type: string
 *           description: The token address trade to
 *         origin_sender_address:
 *           type: string
 *           description: The address of the sender
 *         quanlity_in:
 *           type: number
 *           description: The trade amount in
 *         quanlity_out:
 *           type: number
 *           description: The trade amount out
 *         log_index:
 *           type: number
 *           description: Event sequence
 *         exchange_name:
 *           type: string
 *           description: Pool name
 *         pool_address:
 *           type: string
 *           description: Pool address
 *         amount_usd:
 *           type: number
 *           description: The trade amount in USD
 *         chain:
 *           type: string
 *           description: The chain the trade is on
 *         fee:
 *           type: number
 *           description: The fee of the trade
 *         native_price:
 *           type: number
 *           description: The native price of the trade
 *         timestamp:
 *           type: string
 *           format: date
 *           description: Timestamp of trade
 *       example:
 *         id: "c995d069-06d9-4cad-a101-b9c136df952b"
 *         block: 26995500
 *         tx_hash: "4eknSgGsm68VoybK2ac9vNvVXPvppnRzMAunVi9ymmea"
 *         from_token_address: "0x5d4b302506645c37ff133b98c4b50a5ae14841659738d6d733d59d0d217a93bf::coin::COIN"
 *         to_token_address: "0x2::sui::SUI"
 *         origin_sender_address: "0x02a212de6a9dfa3a69e22387acfbafbb1a9e591bd9d636e7895dcfc8de05f331"
 *         quanlity_in: 4210.803377
 *         quanlity_out: 2500.909465774
 *         log_index: 0
 *         exchange_name: "CETUS"
 *         timestamp: "2024-02-23T09:17:23.117Z"
 *         pool_address: "0xcf994611fd4c48e277ce3ffd4d4364c914af2c3cbb05f7bf6facd371de688630"
 *         amount_usd: 4209.461839519271
 *         chain: "SUI"
 *         fee: 0.0578217732121819
 *         native_price: 1.675381547961669
 */

/**
 * @swagger
 * tags:
 *   name: Trades
 *   description: Trade data
 * /v1/trades:
 *   get:
 *     summary: Lists all the trades
 *     tags: [Trades]
 *     parameters:
 *      - in: query
 *        required: true
 *        name: address
 *        schema:
 *          type: string
 *        description: User wallet address
 *      - in: query
 *        name: offset
 *        schema:
 *          type: integer
 *          default: 0
 *        description: The number of items to skip before starting to collect the result set
 *      - in: query
 *        name: limit
 *        schema:
 *          type: integer
 *          default: 50
 *        description: The numbers of items to return
 *     responses:
 *       200:
 *         description: List trades of owner
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Trade'
 *       404:
 *         description: Address was not found
 */

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const address = String(req.query?.address || "");
    const timestamp = dayjs(
      Number(req.query?.timestamp || dayjs().millisecond())
    );
    if (!address) {
      return res.status(400).json({ message: "Address is required" });
    }
    let offset = Number(req.query?.offset) || 0;
    let limit = Number(req.query?.limit) || 50;
    if (limit > 50) {
      limit = 50;
    }
    if (offset < 0) {
      offset = 0;
    }

    const trades = await prisma.trade.findMany({
      where: {
        AND: [
          {
            origin_sender_address: address,
          },
          { chain: "SUI" },
          {
            timestamp: {
              gte: timestamp.toDate(),
            },
          },
        ],
      },
      orderBy: {
        timestamp: "desc",
      },
      skip: offset,
      take: limit,
    });

    return res.status(200).json({ data: trades });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
