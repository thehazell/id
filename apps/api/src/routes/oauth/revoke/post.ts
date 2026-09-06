import { Hono } from "hono";

import { createDb } from "@/db";
import { revokeAccessToken, revokeRefreshToken } from "@/lib/oauth/tokens";

const route = new Hono<{ Bindings: Env }>();

route.post("/", async (c) => {
	const body = await c.req.parseBody();
	const token = body.token;

	if (typeof token !== "string" || !token) {
		return c.body(null, 200);
	}

	const tokenTypeHint = body.token_type_hint;

	const db = createDb(c.env.DB);

	if (tokenTypeHint === "refresh_token") {
		await revokeRefreshToken(db, token);
	} else {
		await revokeAccessToken(db, token);
	}

	return c.body(null, 200);
});

export default route;
