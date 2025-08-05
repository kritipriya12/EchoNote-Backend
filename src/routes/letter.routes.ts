import express from "express";
import {
    createLetter,
    getUserLetters,
    getLetterById,
    updateLetter,
    deleteLetter,
    getLetterEmailStatus,
    sendLetterEmailNow,
} from "../controllers/letter.controller";
import { authenticateUser } from "../middleware/auth.middleware";

const letterRouter = express.Router();

letterRouter.use(authenticateUser);

letterRouter.post("/", createLetter);
letterRouter.get("/", getUserLetters);
letterRouter.get("/:id", getLetterById);
letterRouter.put("/:id", updateLetter);
letterRouter.delete("/:id", deleteLetter);

letterRouter.get("/:id/email-status", getLetterEmailStatus);
letterRouter.post("/:id/send-email", sendLetterEmailNow);

export default letterRouter;
