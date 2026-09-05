import { eq } from "drizzle-orm";
import type { Context } from "hono";

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
} from "../../lib/oauth/tokens";
import { hashToken } from "../../lib/token";
import { getBasicClientCredentials } from "./client-auth";
import { invalidClient, invalidGrant, invalidRequest } from "./responses";

type TokenRequestBody = Record<string, string | File>;

export async function exchangeAuthorizationCode(
	c: Context<{ Bindings: Env }>,
	body: TokenRequestBody,
) {
	const code = body.code;
	const redirectUri = body.redirect_uri;
	const bodyClientId = body.client_id;
	const codeVerifier = body.code_verifier;
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

	if (
		typeof code !== "string" ||
		typeof redirectUri !== "string" ||
		typeof clientId !== "string"
	) {
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

	if (!validateRedirectUri(client, redirectUri)) {
		return invalidGrant(c);
	}

	const codeHash = await hashToken(code);

	const result = await db
		.select()
		.from(oauthAuthorizationCodes)
		.where(eq(oauthAuthorizationCodes.codeHash, codeHash))
		.limit(1);

	const authorizationCode = result[0];

	if (!authorizationCode) {
		return invalidGrant(c);
	}

	const now = Date.now();

	if (authorizationCode.expiresAt <= now || authorizationCode.usedAt !== null) {
		return invalidGrant(c);
	}

	if (
		authorizationCode.clientId !== client.id ||
		authorizationCode.redirectUri !== redirectUri
	) {
		return invalidGrant(c);
	}

	const codeChallenge = authorizationCode.codeChallenge;

	if (codeChallenge !== null) {
		if (typeof codeVerifier !== "string") {
			return invalidRequest(c, "The code_verifier parameter is required.");
		}

		const validCodeVerifier = await verifyCodeChallenge(
			codeVerifier,
			codeChallenge,
		);

		if (!validCodeVerifier) {
			return invalidGrant(c);
		}
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
		return invalidGrant(c);
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
		nonce: authorizationCode.nonce ?? undefined,
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
