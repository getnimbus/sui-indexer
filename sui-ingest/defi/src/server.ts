import "dotenv/config";
/**
 * @klotho::execution_unit {
 *   id = "nimbus-api-service"
 * }
 */
import express from "express";
import { getUserPositions } from "./protocols";
import cors from "cors";

const app = express();

app.use(
  cors({
    origin: [
      "https://getnimbus.io",
      "https://beta.getnimbus.io",
      "https://app.getnimbus.io",
      "http://localhost:3000",
      "http://localhost:5173",
      "http://localhost:19006",
      "https://nimbus-hackathon.vercel.app",
      "https://xnfts.s3.us-west-2.amazonaws.com", // xNFT
      "https://twa.getnimbus.io",
      "https://airdrop.getnimbus.io",
      /onrender\.com$/,
    ],
  })
);

let isReady = false;
app.get("/", (req, res) => {
  if (isReady) {
    return res.status(200).end("Ok");
  }

  return res.status(500).end("Starting...");
});

app.get("/positions/:address", async (req, res) => {
  try {
    const protocol = req.query.protocol as string;
    const result = await getUserPositions(req.params.address, protocol);
    return res
      .set({
        "Cache-Control": `max-age=120, stale-while-revalidate=120`, // TODO: Remove cache hardcode
      })
      .json({
        data: result.flat(),
      });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      error: error,
    });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`App ready on http://localhost:${port}`);
  isReady = true;
  process && process.send && process.send("ready");
});
