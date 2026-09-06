import { Hono } from "hono";

import { createDb } from "@/db";
import { deleteOAuthClient } from "@/lib/oauth/client";
import { requireAdmin } from "@/middleware/auth";

const route = new Hono<{ Bindings: Env }>();

route.delete("/", requireAdmin, async (c) => {
	const clientId = c.req.param("id");

	if (!clientId) {
		return c.json(
			{
				error: "client_not_found",
			},
			404,
		);
	}

	const db = createDb(c.env.DB);
	const client = await deleteOAuthClient(db, clientId);

	if (!client) {
		return c.json(
			{
				error: "client_not_found",
			},
			404,
		);
	}

	return c.body(null, 204);
});

export default route;
