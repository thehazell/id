import { eq } from "drizzle-orm";
import { Hono } from "hono";

import { createDb } from "@/db";
import { users } from "@/db/schema";
import { hashPassword } from "@/lib/password";

const route = new Hono<{ Bindings: Env }>();

route.post("/", async (c) => {
    const body = await c.req.json<{
        email?: string;
        password?: string;
    }>();

    const email = body.email?.trim().toLowerCase();
    const password = body.password;

    if (!email || !password) {
        return c.json(
            {
                error: "Email and password are required",
            },
            400,
        );
    }

    if (password.length < 8) {
        return c.json(
            {
                error: "Password must be at least 8 characters",
            },
            400,
        );
    }

    const db = createDb(c.env.DB);

    const existingUser = await db
        .select({
            id: users.id,
        })
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

    if (existingUser.length > 0) {
        return c.json(
            {
                error: "An account with that email already exists",
            },
            409,
        );
    }

    const now = Date.now();
    const userId = crypto.randomUUID();
    const passwordHash = await hashPassword(password);

    await db.insert(users).values({
        id: userId,
        email,
        passwordHash,
        createdAt: now,
        updatedAt: now,
    });

    return c.json(
        {
            user: {
                id: userId,
                email,
            },
        },
        201,
    );
});

export default route;
