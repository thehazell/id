import { Hono } from "hono";
import { getCookie } from "hono/cookie";

import { createDb } from "@/db";
import {
    deleteOtherSessions,
    getSession,
} from "@/lib/session";

const route = new Hono<{ Bindings: Env }>();

route.post("/", async (c) => {
    const token = getCookie(c, "session");

    if (!token) {
        return c.json({ error: "Unauthorized" }, 401);
    }

    const db = createDb(c.env.DB);
    const currentSession = await getSession(db, token);

    if (!currentSession) {
        return c.json({ error: "Unauthorized" }, 401);
    }

    await deleteOtherSessions(
        db,
        currentSession.userId,
        currentSession.id,
    );

    return c.json({
        success: true,
    });
});

export default route;
