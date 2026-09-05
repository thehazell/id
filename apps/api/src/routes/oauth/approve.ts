import { Hono } from "hono";
import { getCookie } from "hono/cookie";

import { createDb } from "../../db";
import { oauthAuthorizationCodes } from "../../db/schema";
import {
	clientSupportsScopes,
	getOAuthClient,
	validateRedirectUri,
} from "../../lib/oauth/client";
import { grantOAuthAccess } from "../../lib/oauth/grant";
import { getSessionUserWithSession } from "../../lib/session";
import { hashToken } from "../../lib/token";

const AUTHORIZATION_CODE_DURATION = 60 * 1000;

const approveRoute = new Hono<{
	Bindings: Env;
}>();

approveRoute.post("/", async (c) => {
	const body = await c.req.json<{
		client_id: string;
		redirect_uri: string;
		response_type: string;
		scope: string;
		state?: string;
		nonce?: string;
		code_challenge?: string;
		code_challenge_method?: string;
	}>();

	/**
	 * Validate required authorization parameters.
	 */
	if (
		!body.client_id ||
		!body.redirect_uri ||
		!body.response_type ||
		!body.scope
	) {
		return c.json(
			{
				error: "invalid_request",
				error_description: "Missing required parameters.",
			},
			400,
		);
	}

	/**
	 * Maze ID currently supports only the authorization code flow.
	 */
	if (body.response_type !== "code") {
		return c.json(
			{
				error: "unsupported_response_type",
				error_description: "Only the authorization code flow is supported.",
			},
			400,
		);
	}

	/**
	 * Validate PKCE when supplied.
	 *
	 * PKCE is optional for the authorization request. However, if
	 * either PKCE parameter is supplied, both must be present and
	 * the challenge method must be S256.
	 */
	if (body.code_challenge || body.code_challenge_method) {
		if (!body.code_challenge) {
			return c.json(
				{
					error: "invalid_request",
					error_description: "The code_challenge parameter is required.",
				},
				400,
			);
		}

		if (!body.code_challenge_method) {
			return c.json(
				{
					error: "invalid_request",
					error_description: "The code_challenge_method parameter is required.",
				},
				400,
			);
		}

		if (body.code_challenge_method !== "S256") {
			return c.json(
				{
					error: "invalid_request",
					error_description: "Only S256 PKCE is supported.",
				},
				400,
			);
		}

		/**
		 * RFC 7636 S256 code challenges are base64url-encoded
		 * SHA-256 hashes and therefore 43 characters long.
		 */
		if (!/^[A-Za-z0-9_-]{43}$/.test(body.code_challenge)) {
			return c.json(
				{
					error: "invalid_request",
					error_description: "Invalid PKCE code challenge.",
				},
				400,
			);
		}
	}

	const db = createDb(c.env.DB);

	/**
	 * Load the OAuth client.
	 */
	const client = await getOAuthClient(db, body.client_id);

	if (!client) {
		return c.json(
			{
				error: "invalid_request",
				error_description: "Unknown client.",
			},
			400,
		);
	}

	/**
	 * Validate the redirect URI again.
	 *
	 * Never trust the redirect URI supplied by the dashboard without
	 * validating it against the registered client.
	 */
	if (!validateRedirectUri(client, body.redirect_uri)) {
		return c.json(
			{
				error: "invalid_request",
				error_description: "Invalid redirect URI.",
			},
			400,
		);
	}

	/**
	 * Parse and normalize scopes.
	 */
	const scopes = [...new Set(body.scope.split(" ").filter(Boolean))];

	if (scopes.length === 0) {
		return c.json(
			{
				error: "invalid_scope",
				error_description: "At least one scope is required.",
			},
			400,
		);
	}

	/**
	 * OIDC requires the openid scope.
	 */
	if (!scopes.includes("openid")) {
		return c.json(
			{
				error: "invalid_scope",
				error_description: "The openid scope is required.",
			},
			400,
		);
	}

	/**
	 * Ensure the requested scopes are allowed for the client.
	 */
	if (!clientSupportsScopes(client, scopes)) {
		return c.json(
			{
				error: "invalid_scope",
				error_description: "One or more requested scopes are not allowed.",
			},
			400,
		);
	}

	/**
	 * Require an authenticated user before granting access.
	 */
	const sessionToken = getCookie(c, "session");

	if (!sessionToken) {
		return c.json(
			{
				error: "login_required",
			},
			401,
		);
	}

	const sessionRecord = await getSessionUserWithSession(db, sessionToken);

	if (!sessionRecord) {
		return c.json(
			{
				error: "login_required",
			},
			401,
		);
	}

	const { user } = sessionRecord;

	/**
	 * Record the user's grant for this client.
	 */
	await grantOAuthAccess(db, {
		userId: user.id,
		clientId: client.id,
		scopes,
	});

	/**
	 * Generate a one-time authorization code.
	 *
	 * Only the hash is stored in the database.
	 */
	const code = crypto.randomUUID();
	const codeHash = await hashToken(code);

	const now = Date.now();

	await db.insert(oauthAuthorizationCodes).values({
		id: crypto.randomUUID(),
		clientId: client.id,
		userId: user.id,
		codeHash,
		redirectUri: body.redirect_uri,
		scope: scopes.join(" "),
		nonce: body.nonce,
		codeChallenge: body.code_challenge,
		codeChallengeMethod: body.code_challenge_method,
		expiresAt: now + AUTHORIZATION_CODE_DURATION,
		createdAt: now,
	});

	/**
	 * Build the redirect response.
	 */
	const location = new URL(body.redirect_uri);

	location.searchParams.set("code", code);

	if (body.state) {
		location.searchParams.set("state", body.state);
	}

	return c.json({
		redirect_uri: location.toString(),
	});
});

export default approveRoute;
