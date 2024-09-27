import express from "express";
import MessageResponse from "../interfaces/MessageResponse";
import tokens from "./tokens";
import trades from "./trades";
import holding from "./holding";
import yields from "./yields";

const router = express.Router();

router.get<{}, MessageResponse>("/", (req, res) => {
  res.json({
    message: "api version 1.0.0",
  });
});

router.use("/tokens", tokens);
router.use("/trades", trades);
router.use("/holding", holding);
router.use("/yields", yields);

export default router;
