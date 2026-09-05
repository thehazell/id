import { Hono } from "hono";

import { exchangeAuthorizationCode } from "../../lib/oauth/authorization-code";
import { exchangeRefreshToken } from "../../lib/oauth/refresh-token";
import { unsupportedGrantType } from "../../lib/oauth/responses";

const tokenRoute = new Hono<{ Bindings: Env }>();

tokenRoute.post("/", async (c) => {
	const body = await c.req.parseBody();

	switch (body.grant_type) {
		case "authorization_code":
			return exchangeAuthorizationCode(c, body);

		case "refresh_token":
			return exchangeRefreshToken(c, body);

		default:
			return unsupportedGrantType(c);
	}
});

export default tokenRoute;
