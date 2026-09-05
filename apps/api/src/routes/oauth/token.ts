import { eq } from "drizzle-orm";
import { Hono } from "hono";

import { createDb } from "../../db";
import { oauthAuthorizationCodes } from "../../db/schema";
import {
	getOAuthClient,
	validateRedirectUri,
	verifyClientSecret,
} from "../../lib/oauth/client";
import { createIdToken } from "../../lib/oauth/id-token";
import { verifyCodeChallenge } from "../../lib/oauth/pkce";
import {
	ACCESS_TOKEN_DURATION,
	createAccessToken,
	createRefreshToken,
	getRefreshToken,
	revokeRefreshToken,
} from "../../lib/oauth/tokens";
import { hashToken } from "../../lib/token";

const tokenRoute = new Hono<{ Bindings: Env }>();

tokenRoute.post("/", async (c) => {
	const body = await c.req.parseBody();
	const grantType = body.grant_type;

	if (grantType === "authorization_code") {
		const code = body.code;
		const redirectUri = body.redirect_uri;
		const clientId = body.client_id;
		const codeVerifier = body.code_verifier;
		const clientSecret = body.client_secret;

		if (
			typeof code !== "string" ||
			typeof redirectUri !== "string" ||
			typeof clientId !== "string" ||
			typeof codeVerifier !== "string"
		) {
			return c.json(
				{
					error: "invalid_request",
					error_description: "Missing required parameters.",
				},
				400,
			);
		}

		const db = createDb(c.env.DB);
		const client = await getOAuthClient(db, clientId);

		if (!client) {
			return c.json(
				{
					error: "invalid_client",
				},
				401,
			);
		}

		if (client.clientType === "confidential") {
			if (
				typeof clientSecret !== "string" ||
				!(await verifyClientSecret(client, clientSecret))
			) {
				return c.json(
					{
						error: "invalid_client",
					},
					401,
				);
			}
		}

		if (!validateRedirectUri(client, redirectUri)) {
			return c.json(
				{
					error: "invalid_grant",
				},
				400,
			);
		}

		const codeHash = await hashToken(code);
		const result = await db
			.select()
			.from(oauthAuthorizationCodes)
			.where(eq(oauthAuthorizationCodes.codeHash, codeHash))
			.limit(1);

		const authorizationCode = result[0];

		if (!authorizationCode) {
			return c.json(
				{
					error: "invalid_grant",
				},
				400,
			);
		}

		const now = Date.now();

		if (
			authorizationCode.expiresAt <= now ||
			authorizationCode.usedAt !== null
		) {
			return c.json(
				{
					error: "invalid_grant",
				},
				400,
			);
		}

		if (
			authorizationCode.clientId !== client.id ||
			authorizationCode.redirectUri !== redirectUri
		) {
			return c.json(
				{
					error: "invalid_grant",
				},
				400,
			);
		}

		const validCodeVerifier = await verifyCodeChallenge(
			codeVerifier,
			authorizationCode.codeChallenge,
		);

		if (!validCodeVerifier) {
			return c.json(
				{
					error: "invalid_grant",
				},
				400,
			);
		}

		const updated = await db
			.update(oauthAuthorizationCodes)
			.set({
				usedAt: now,
			})
			.where(eq(oauthAuthorizationCodes.id, authorizationCode.id))
			.returning({
				id: oauthAuthorizationCodes.id,
			});

		if (updated.length === 0) {
			return c.json(
				{
					error: "invalid_grant",
				},
				400,
			);
		}

		const accessToken = await createAccessToken(
			db,
			client.id,
			authorizationCode.userId,
			authorizationCode.scope,
		);

		const refreshToken = await createRefreshToken(
			db,
			client.id,
			authorizationCode.userId,
			authorizationCode.scope,
		);

		const idToken = await createIdToken({
			privateKey: c.env.OIDC_PRIVATE_KEY,
			issuer: c.env.OIDC_ISSUER,
			clientId: client.id,
			userId: authorizationCode.userId,
			nonce: authorizationCode.nonce,
			expiresIn: ACCESS_TOKEN_DURATION / 1000,
		});

		return c.json({
			access_token: accessToken.token,
			token_type: "Bearer",
			expires_in: ACCESS_TOKEN_DURATION / 1000,
			refresh_token: refreshToken.token,
			id_token: idToken,
			scope: authorizationCode.scope,
		});
	}

	if (grantType === "refresh_token") {
		const refreshTokenValue = body.refresh_token;
		const clientId = body.client_id;
		const clientSecret = body.client_secret;

		if (typeof refreshTokenValue !== "string" || typeof clientId !== "string") {
			return c.json(
				{
					error: "invalid_request",
				},
				400,
			);
		}

		const db = createDb(c.env.DB);
		const client = await getOAuthClient(db, clientId);

		if (!client) {
			return c.json(
				{
					error: "invalid_client",
				},
				401,
			);
		}

		if (client.clientType === "confidential") {
			if (
				typeof clientSecret !== "string" ||
				!(await verifyClientSecret(client, clientSecret))
			) {
				return c.json(
					{
						error: "invalid_client",
					},
					401,
				);
			}
		}

		const storedRefreshToken = await getRefreshToken(db, refreshTokenValue);

		if (!storedRefreshToken) {
			return c.json(
				{
					error: "invalid_grant",
				},
				400,
			);
		}

		if (storedRefreshToken.clientId !== client.id) {
			return c.json(
				{
					error: "invalid_grant",
				},
				400,
			);
		}

		await revokeRefreshToken(db, refreshTokenValue);

		const accessToken = await createAccessToken(
			db,
			client.id,
			storedRefreshToken.userId,
			storedRefreshToken.scope,
		);

		const newRefreshToken = await createRefreshToken(
			db,
			client.id,
			storedRefreshToken.userId,
			storedRefreshToken.scope,
		);

		return c.json({
			access_token: accessToken.token,
			token_type: "Bearer",
			expires_in: ACCESS_TOKEN_DURATION / 1000,
			refresh_token: newRefreshToken.token,
			scope: storedRefreshToken.scope,
		});
	}

	return c.json(
		{
			error: "unsupported_grant_type",
		},
		400,
	);
});

export default tokenRoute;
