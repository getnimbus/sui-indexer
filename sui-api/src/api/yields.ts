import express from "express";
import { prisma } from "@services/db";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
dayjs.extend(utc);

/**
 * @swagger
 * components:
 *   schemas:
 *     Vault:
 *        type: object
 *        properties:
 *          id:
 *            type: string
 *            description: The vault id
 *          name:
 *            type: string
 *            description: The vault name
 *          chain:
 *            type: string
 *            description: The vault chain
 *          protocol:
 *            type: string
 *            description: The vault protocol
 *          apy:
 *            type: number
 *            description: The vault apy
 *          apy_7_day:
 *            type: number
 *            description: The vault apy 7 day
 *          tvl:
 *            type: number
 *            description: Total value locked of the vault
 *          farm_link:
 *            type: text
 *            description: The farm link of the vault
 *          synced_at:
 *            type: string
 *            format: date-time
 *            description: The time the vault was last synced
 *        example:
 *          id: "2e82fcb85752dec4a966eb49c82b0f7e"
 *          name: "SUI"
 *          chain: "SUI"
 *          protocol: "navi-lending"
 *          apy: 16.1277
 *          apy_7_day: 16.1277
 *          tvl: 69211937
 *          reward: {"pool": "f8ffbfd7-7448-45f4-9cc4-f8c1185489a2", "predictions": {"predictedClass": "Stable/Up", "binnedConfidence": 1, "predictedProbability": 57.99999999999999}, "rewardTokens": ["549e8b69270defbfafd4f94e17ec44cdbdd99820b33bda2278dea3b9a32d3f55::cert::CERT"]}
 *          farm_link: "https://www.naviprotocol.io/"
 *          synced_at: "2024-03-08 04:17:49.151641+00"
 */

/**
 * @swagger
 * tags:
 *   name: Yields
 *   description: Yields farming
 * /v1/yields:
 *   get:
 *     summary: Lists all the vaults for yield farming
 *     tags: [Yields]
 *     responses:
 *       200:
 *         description: Lists of vaults
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Vault'
 */

const router = express.Router();

router.get("/", async (req, res) => {
  const today = dayjs.utc().startOf("day");

  try {
    const yields = await prisma.defi_vaults.findMany({
      where: {
        synced_at: {
          gte: today.toDate(),
          lte: today.endOf("day").toDate(),
        },
        chain: "SUI",
      },
      orderBy: [
        {
          tvl: "desc",
        },
        {
          apy: "desc",
        },
      ],
    });

    return res.status(200).json({ data: yields });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
