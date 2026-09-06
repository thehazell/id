import { Hono } from "hono";

import { createDb } from "@/db";
import { getOAuthClients } from "@/lib/oauth/client";
import { requireAdmin } from "@/middleware/auth";

const route = new Hono<{ Bindings: Env }>();

route.get("/", requireAdmin, async (c) => {
	const db = createDb(c.env.DB);
	const clients = await getOAuthClients(db);

	return c.json({
		clients: clients.map((client) => ({
			id: client.id,
			name: client.name,
			clientType: client.clientType,
			redirectUris: client.redirectUris,
			scopes: client.scopes,
			createdAt: client.createdAt,
			updatedAt: client.updatedAt,
		})),
	});
});

export default route;
