import { Hono } from "hono";

import { createDb } from "@/db";
import { revokeOAuthAccess } from "@/lib/oauth/grant";
import { requireAuth } from "@/middleware/auth";

const route = new Hono<{ Bindings: Env }>();

route.delete("/", requireAuth, async (c) => {
    const user = c.get("user");
    const clientId = c.req.param("clientId");

    if (!clientId) {
        return c.json(
            {
                error: "client_not_found",
            },
            404,
        );
    }

    const db = createDb(c.env.DB);

    await revokeOAuthAccess(db, user.id, clientId);

    return c.json({
        success: true,
    });
});

export default route;
