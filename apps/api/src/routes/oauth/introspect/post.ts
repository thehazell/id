import { Hono } from "hono";

import { createDb } from "@/db";
import { getAccessToken } from "@/lib/oauth/tokens";

const route = new Hono<{ Bindings: Env }>();

route.post("/", async (c) => {
	const body = await c.req.parseBody();
	const token = body.token;

	if (typeof token !== "string" || !token) {
		return c.json({
			active: false,
		});
	}

	const db = createDb(c.env.DB);
	const accessToken = await getAccessToken(db, token);

	if (!accessToken) {
		return c.json({
			active: false,
		});
	}

	return c.json({
		active: true,
		client_id: accessToken.clientId,
		username: accessToken.userId,
		sub: accessToken.userId,
		scope: accessToken.scope,
		exp: Math.floor(accessToken.expiresAt / 1000),
		iat: Math.floor(accessToken.createdAt / 1000),
	});
});

export default route;
