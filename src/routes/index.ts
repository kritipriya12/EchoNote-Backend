import express from "express";
import authRouter from "./auth.routes";
import letterRouter from "./letter.routes";

const router = express.Router();

router.use("/auth", authRouter);
router.use("/letters", letterRouter);

export default router;