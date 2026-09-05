import { Hono } from "hono";

import { createDb } from "../../db";
import { getOAuthClient } from "../../lib/oauth/client";
import { hasOAuthGrant } from "../../lib/oauth/grant";
import { requireAuth } from "../../middleware/auth";

const grant = new Hono<{ Bindings: Env }>();

grant.get("/", requireAuth, async (c) => {
	const clientId = c.req.query("client_id");
	const scope = c.req.query("scope");

	if (!clientId || !scope) {
		return c.json(
			{
				error: "invalid_request",
			},
			400,
		);
	}

	const db = createDb(c.env.DB);
	const user = c.get("user");

	const client = await getOAuthClient(db, clientId);

	if (!client) {
		return c.json(
			{
				error: "invalid_client",
			},
			400,
		);
	}

	const scopes = [...new Set(scope.split(" ").filter(Boolean))];

	const granted = await hasOAuthGrant(db, user.id, client.id, scopes);

	return c.json({
		granted,
	});
});

export default grant;
