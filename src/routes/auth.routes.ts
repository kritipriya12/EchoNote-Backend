import express from "express";
import { signup, signIn } from "../controllers/auth.controller";
import { authenticateUser } from "../middleware/auth.middleware";

const authRouter = express.Router();

authRouter.post("/signup", signup);
authRouter.post("/signin", signIn);

authRouter.post("/signout", (req, res) => {
    res.clearCookie("token");
    res.status(200).json({ message: "Signed out successfully" });
});

authRouter.get("/me", authenticateUser, (req, res) => {
    res.status(200).json({
        user: req.user,
    });
});

export default authRouter;