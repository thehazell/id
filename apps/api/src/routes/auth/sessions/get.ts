import { Hono } from "hono";
import { getCookie } from "hono/cookie";

import { createDb } from "@/db";
import {
    getSession,
    getUserSessions,
} from "@/lib/session";

const route = new Hono<{ Bindings: Env }>();

route.get("/", async (c) => {
    const token = getCookie(c, "session");

    if (!token) {
        return c.json({ error: "Unauthorized" }, 401);
    }

    const db = createDb(c.env.DB);
    const currentSession = await getSession(db, token);

    if (!currentSession) {
        return c.json({ error: "Unauthorized" }, 401);
    }

    const userSessions = await getUserSessions(
        db,
        currentSession.userId,
    );

    return c.json({
        sessions: userSessions.map((session) => ({
            ...session,
            current: session.id === currentSession.id,
        })),
    });
});

export default route;
