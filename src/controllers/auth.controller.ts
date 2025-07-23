import { Request, Response } from "express";

export const signup = async (req: Request, res: Response) => {
    try {
        const { data } = req.body;

         res.status(200).json({ message: "Signup successful" });
    } catch (error) {
        res.status(500).json({ error: "Server error" });
    }
}