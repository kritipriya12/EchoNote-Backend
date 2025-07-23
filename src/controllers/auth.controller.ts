import { Request, Response } from "express";
import { signupSchema } from "../schema";
import { db } from "../lib/db";

export const signup = async (req: Request, res: Response) => {
    try {
        const { data } = req.body;

        const signupData = signupSchema.safeParse(data)

        if (!signupData.success) {
            res.status(400).json({ error: signupData.error.issues });
            return
        }

        const { email, name, password } = signupData.data;

        const existingUser = await db.user.findUnique({
            where: {
                email,
            }
        })

        if (existingUser) {
            res.status(401).json({ error: "User already exists, Please Sign In" });
            return
        }

        const user = await db.user.create({
            data: {
                email,
                name,
                password,
            }
        })

        res.status(200).json({ message: "Signup successful" });
    } catch (error) {
        res.status(500).json({ error: "Server error" });
    }
}