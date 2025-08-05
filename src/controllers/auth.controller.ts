import { Request, Response } from "express";
import { signinSchema, signupSchema } from "../schema";
import { db } from "../lib/db";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const signToken = (id: string) => {
    const secret = process.env.JWT_SECRET as string;

    return jwt.sign({ id }, secret, {
        expiresIn: `${Number(process.env.JWT_EXPIRES_IN) * 24 * 60 * 60}s`,
    });
};

const createSendToken = (
    user: any,
    statusCode: number,
    res: Response,
    message: string
) => {
    const token = signToken(user.id);

    const cookieOptions = {
        expires: new Date(
            Date.now() +
            Number(process.env.JWT_COOKIE_EXPIRES_IN) * 24 * 60 * 60 * 1000
        ),
        httpOnly: true,
        sameSite: "none" as "none", 
        secure: true
    };

    res.cookie("token", token, cookieOptions);

    res.status(statusCode).json({
        token,
        message,
        status: 201,
    });
};


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

        const hashedPassword = await bcrypt.hash(password, 12);

        const user = await db.user.create({
            data: {
                email,
                name,
                password: hashedPassword,
            }
        })

        createSendToken(user, 201, res, "User created");
    } catch (error) {
        res.status(500).json({ error: "Server error" });
    }
}

export const signIn = async (req: Request, res: Response) => {
    try {
        const { data } = req.body;

        const signupData = signinSchema.safeParse(data)

        if (!signupData.success) {
            res.status(400).json({ error: signupData.error.issues });
            return
        }

        const { email, password } = signupData.data;

        if (!email || !password) {
            res.status(400).json({ error: "Please provide email and password" });
            return
        }

        const user = await db.user.findUnique({
            where: {
                email,
            }
        })

          if (!user) {
            res.status(401).json({ error: "Incorrect email or password" });
            return
        }

        const correctPassword = await bcrypt.compare(password, user?.password);

        if (!correctPassword) {
            res.status(401).json({ error: "Incorrect email or password" });
            return
        }

        createSendToken(user, 200, res, "Login successful");

    } catch (error) {
        console.log("ERROR_SIGN_IN", error);
        res.status(500).json({
            message: "Internal Server Error",
        });
    }
}