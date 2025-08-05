import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { db } from "../lib/db";

declare global {
    namespace Express {
        interface Request {
            user?: {
                id: string;
                email: string;
                name: string;
            };
        }
    }
}

interface JwtPayload {
    id: string;
}

export const authenticateUser = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const token = req.cookies.token;

        if (!token) {
            return res.status(401).json({ error: "Access denied. No token provided." });
        }

        const secret = process.env.JWT_SECRET as string;
        const decoded = jwt.verify(token, secret) as JwtPayload;

        const user = await db.user.findUnique({
            where: { id: decoded.id },
            select: {
                id: true,
                email: true,
                name: true,
            }
        });

        if (!user) {
            return res.status(401).json({ error: "Invalid token. User not found." });
        }

        req.user = user;
        next();
    } catch (error) {
        console.error("Authentication error:", error);
        return res.status(401).json({ error: "Invalid token." });
    }
};

export const optionalAuth = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const token = req.cookies.token;

        if (token) {
            const secret = process.env.JWT_SECRET as string;
            const decoded = jwt.verify(token, secret) as JwtPayload;

            const user = await db.user.findUnique({
                where: { id: decoded.id },
                select: {
                    id: true,
                    email: true,
                    name: true,
                }
            });

            if (user) {
                req.user = user;
            }
        }

        next();
    } catch (error) {
        next();
    }
};
