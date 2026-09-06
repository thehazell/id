import { Hono } from "hono";

import { createDb } from "@/db";
import { getOAuthClient } from "@/lib/oauth/client";

const route = new Hono<{ Bindings: Env }>();

route.get("/", async (c) => {
	const clientId = c.req.query("client_id");

	if (!clientId) {
		return c.json(
			{
				error: "invalid_request",
				error_description: "client_id is required.",
			},
			400,
		);
	}

	const db = createDb(c.env.DB);
	const client = await getOAuthClient(db, clientId);

	if (!client) {
		return c.json(
			{
				error: "invalid_request",
				error_description: "Unknown client.",
			},
			400,
		);
	}

	return c.json({
		client_id: client.id,
		name: client.name,
	});
});

export default route;
