import z from "zod"

export const signupSchema = z.object({
    email: z.string().email(),
    name: z.string().min(3),
    password: z.string().min(6),
})

export const signinSchema = z.object({
    email: z.string().email(),
    password: z.string().min(6),
})