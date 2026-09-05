import { eq } from "drizzle-orm";
import type { Context } from "hono";

import { createDb } from "../../db";
import { oauthRefreshTokens } from "../../db/schema";
import { getOAuthClient, verifyClientSecret } from "../../lib/oauth/client";
import {
	ACCESS_TOKEN_DURATION,
	createAccessToken,
	createRefreshToken,
} from "../../lib/oauth/tokens";
import { hashToken } from "../../lib/token";
import { getBasicClientCredentials } from "./client-auth";
import { invalidClient, invalidGrant, invalidRequest } from "./responses";

type TokenRequestBody = Record<string, string | File>;

export async function exchangeRefreshToken(
	c: Context<{ Bindings: Env }>,
	body: TokenRequestBody,
) {
	const refreshToken = body.refresh_token;
	const bodyClientId = body.client_id;
	const bodyClientSecret = body.client_secret;

	const basicCredentials = getBasicClientCredentials(
		c.req.header("Authorization"),
	);

	const clientId =
		basicCredentials?.clientId ??
		(typeof bodyClientId === "string" ? bodyClientId : undefined);

	const clientSecret =
		basicCredentials?.clientSecret ??
		(typeof bodyClientSecret === "string" ? bodyClientSecret : undefined);

	if (typeof refreshToken !== "string" || typeof clientId !== "string") {
		return invalidRequest(c, "Missing required parameters.");
	}

	const db = createDb(c.env.DB);
	const client = await getOAuthClient(db, clientId);

	if (!client) {
		return invalidClient(c);
	}

	if (client.clientType === "confidential") {
		if (
			typeof clientSecret !== "string" ||
			!(await verifyClientSecret(client, clientSecret))
		) {
			return invalidClient(c);
		}
	} else if (basicCredentials) {
		return invalidRequest(
			c,
			"Public clients must not use client authentication.",
		);
	}

	const tokenHash = await hashToken(refreshToken);

	const result = await db
		.select()
		.from(oauthRefreshTokens)
		.where(eq(oauthRefreshTokens.tokenHash, tokenHash))
		.limit(1);

	const storedToken = result[0];

	if (!storedToken) {
		return invalidGrant(c);
	}

	const now = Date.now();

	if (storedToken.expiresAt <= now || storedToken.revokedAt !== null) {
		return invalidGrant(c);
	}

	if (storedToken.clientId !== client.id) {
		return invalidGrant(c);
	}

	const accessToken = await createAccessToken(
		db,
		client.id,
		storedToken.userId,
		storedToken.scope,
		storedToken.id,
	);

	const newRefreshToken = await createRefreshToken(
		db,
		client.id,
		storedToken.userId,
		storedToken.scope,
	);

	await db
		.update(oauthRefreshTokens)
		.set({
			revokedAt: now,
			replacedBy: newRefreshToken.id,
		})
		.where(eq(oauthRefreshTokens.id, storedToken.id));

	return c.json({
		access_token: accessToken.token,
		token_type: "Bearer",
		expires_in: ACCESS_TOKEN_DURATION / 1000,
		refresh_token: newRefreshToken.token,
		scope: storedToken.scope,
	});
}
