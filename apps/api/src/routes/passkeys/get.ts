import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { getCookie } from "hono/cookie";

import { createDb } from "@/db";
import { passkeys } from "@/db/schema";
import { getSessionUser } from "@/lib/session";

const route = new Hono<{ Bindings: Env }>();

route.get("/", async (c) => {
    const token = getCookie(c, "session");

    if (!token) {
        return c.json(
            {
                error: "Unauthorized",
            },
            401,
        );
    }

    const db = createDb(c.env.DB);
    const user = await getSessionUser(db, token);

    if (!user) {
        return c.json(
            {
                error: "Unauthorized",
            },
            401,
        );
    }

    const result = await db
        .select({
            id: passkeys.id,
            name: passkeys.name,
            createdAt: passkeys.createdAt,
            lastUsedAt: passkeys.lastUsedAt,
        })
        .from(passkeys)
        .where(eq(passkeys.userId, user.id));

    return c.json({
        passkeys: result,
    });
});

export default route;
