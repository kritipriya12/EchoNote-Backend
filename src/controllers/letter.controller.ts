import { Request, Response } from "express";
import { db } from "../lib/db";
import { z } from "zod";
import { sendLetterEmail } from "../utils/email";

const createLetterSchema = z.object({
    title: z.string().min(1, "Title is required").max(200, "Title too long"),
    content: z.string().min(1, "Content is required"),
    deliveryDate: z.string().datetime("Invalid delivery date"),
    reminders: z.number().int().min(0).max(5).default(1),
    tags: z.array(z.string()).default([]),
    hasImage: z.boolean().default(false),
    hasVoice: z.boolean().default(false),
    imageUrl: z.string().url().optional(),
    voiceUrl: z.string().url().optional(),
});

const updateLetterSchema = createLetterSchema.partial();

export const createLetter = async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ error: "User not authenticated" });
        }

        const { data } = req.body;
        const validatedData = createLetterSchema.parse(data);

        const deliveryDate = new Date(validatedData.deliveryDate);
        if (deliveryDate <= new Date()) {
            return res.status(400).json({ error: "Delivery date must be in the future" });
        }

        const letter = await db.letter.create({
            data: {
                ...validatedData,
                deliveryDate,
                userId,
            },
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                    }
                }
            }
        });

        res.status(201).json({
            message: "Letter created successfully",
            letter,
        });
    } catch (error) {
        console.error("Create letter error:", error);
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: error });
        }
        res.status(500).json({ error: "Internal server error" });
    }
};

export const getUserLetters = async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ error: "User not authenticated" });
        }

        const { status, limit = 50, offset = 0 } = req.query;

        const whereClause: any = { userId };
        if (status && typeof status === 'string') {
            whereClause.status = status.toUpperCase();
        }

        const letters = await db.letter.findMany({
            where: whereClause,
            orderBy: [
                { createdAt: 'desc' }
            ],
            take: parseInt(limit as string),
            skip: parseInt(offset as string),
        });

        res.status(200).json({
            letters,
            total: await db.letter.count({ where: whereClause }),
        });
    } catch (error) {
        console.error("Get letters error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};

export const getLetterById = async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ error: "User not authenticated" });
        }

        const { id } = req.params;

        const letter = await db.letter.findFirst({
            where: {
                id,
                userId, 
            },
        });

        if (!letter) {
            return res.status(404).json({ error: "Letter not found" });
        }

        res.status(200).json({ letter });
    } catch (error) {
        console.error("Get letter error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};

export const updateLetter = async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ error: "User not authenticated" });
        }

        const { id } = req.params;
        const { data } = req.body;
        const validatedData = updateLetterSchema.parse(data);

        const existingLetter = await db.letter.findFirst({
            where: {
                id,
                userId,
            },
        });

        if (!existingLetter) {
            return res.status(404).json({ error: "Letter not found" });
        }

        if (validatedData.deliveryDate) {
            const deliveryDate = new Date(validatedData.deliveryDate);
            if (deliveryDate <= new Date()) {
                return res.status(400).json({ error: "Delivery date must be in the future" });
            }
            validatedData.deliveryDate = deliveryDate.toISOString();
        }

        const updatedLetter = await db.letter.update({
            where: { id },
            data: validatedData,
        });

        res.status(200).json({
            message: "Letter updated successfully",
            letter: updatedLetter,
        });
    } catch (error) {
        console.error("Update letter error:", error);
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: error });
        }
        res.status(500).json({ error: "Internal server error" });
    }
};

export const deleteLetter = async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ error: "User not authenticated" });
        }

        const { id } = req.params;

        const existingLetter = await db.letter.findFirst({
            where: {
                id,
                userId,
            },
        });

        if (!existingLetter) {
            return res.status(404).json({ error: "Letter not found" });
        }

        await db.letter.delete({
            where: { id },
        });

        res.status(200).json({
            message: "Letter deleted successfully",
        });
    } catch (error) {
        console.error("Delete letter error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};

export const getLetterEmailStatus = async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ error: "User not authenticated" });
        }

        const { id } = req.params;

        const letter = await db.letter.findFirst({
            where: {
                id,
                userId,
            },
            include: {
                emailDeliveries: {
                    orderBy: {
                        createdAt: 'desc',
                    },
                },
            },
        });

        if (!letter) {
            return res.status(404).json({ error: "Letter not found" });
        }

        res.status(200).json({
            letter: {
                id: letter.id,
                title: letter.title,
                status: letter.status,
                deliveryDate: letter.deliveryDate,
                reminders: letter.reminders,
            },
            emailDeliveries: letter.emailDeliveries,
        });
    } catch (error) {
        console.error("Get letter email status error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};

export const sendLetterEmailNow = async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ error: "User not authenticated" });
        }

        const { id } = req.params;
        const { deliveryType = 'INITIAL_DELIVERY', reminderNumber } = req.body;

        const letter = await db.letter.findFirst({
            where: {
                id,
                userId,
            },
        });

        if (!letter) {
            return res.status(404).json({ error: "Letter not found" });
        }

        const result = await sendLetterEmail(id, deliveryType, reminderNumber);

        if (result.success) {
            res.status(200).json({
                message: "Email sent successfully",
                emailDeliveryId: result.emailDeliveryId,
            });
        } else {
            res.status(500).json({
                error: "Failed to send email",
                details: result.error,
                emailDeliveryId: result.emailDeliveryId,
            });
        }
    } catch (error) {
        console.error("Send letter email now error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};
