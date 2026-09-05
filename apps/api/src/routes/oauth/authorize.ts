import { Hono } from "hono";

import { createDb } from "../../db";
import {
	clientSupportsScopes,
	getOAuthClient,
	validateRedirectUri,
} from "../../lib/oauth/client";

const authorizeRoute = new Hono<{
	Bindings: Env;
}>();

authorizeRoute.get("/", async (c) => {
	const clientId = c.req.query("client_id");
	const redirectUri = c.req.query("redirect_uri");
	const responseType = c.req.query("response_type");
	const scope = c.req.query("scope");
	const state = c.req.query("state");
	const nonce = c.req.query("nonce");
	const codeChallenge = c.req.query("code_challenge");
	const codeChallengeMethod = c.req.query("code_challenge_method");

	if (
		!clientId ||
		!redirectUri ||
		!responseType ||
		!scope ||
		!codeChallenge ||
		!codeChallengeMethod
	) {
		return c.json(
			{
				error: "invalid_request",
				error_description: "Missing required authorization parameters.",
			},
			400,
		);
	}

	if (responseType !== "code") {
		return c.json(
			{
				error: "unsupported_response_type",
			},
			400,
		);
	}

	if (codeChallengeMethod !== "S256") {
		return c.json(
			{
				error: "invalid_request",
				error_description: "Only S256 PKCE is supported.",
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

	if (!validateRedirectUri(client, redirectUri)) {
		return c.json(
			{
				error: "invalid_request",
				error_description: "Invalid redirect URI.",
			},
			400,
		);
	}

	const scopes = [...new Set(scope.split(" ").filter(Boolean))];

	if (!scopes.includes("openid")) {
		return c.json(
			{
				error: "invalid_scope",
				error_description: "The openid scope is required.",
			},
			400,
		);
	}

	if (!clientSupportsScopes(client, scopes)) {
		return c.json(
			{
				error: "invalid_scope",
				error_description:
					"One or more requested scopes are not allowed.",
			},
			400,
		);
	}

	const params = new URLSearchParams();

	params.set("client_id", client.id);
	params.set("redirect_uri", redirectUri);
	params.set("scope", scopes.join(" "));
	params.set("response_type", responseType);
	params.set("code_challenge", codeChallenge);
	params.set("code_challenge_method", codeChallengeMethod);

	if (state) {
		params.set("state", state);
	}

	if (nonce) {
		params.set("nonce", nonce);
	}

	const authorizeUrl = new URL(
		"/authorize",
		`https://${c.env.DASHBOARD_DOMAIN}`,
	);

	authorizeUrl.search = params.toString();

	return c.redirect(authorizeUrl.toString(), 302);
});

export default authorizeRoute;
