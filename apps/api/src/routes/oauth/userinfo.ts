import { eq } from "drizzle-orm";
import { Hono } from "hono";
import type { Context } from "hono";

import { createDb } from "../../db";
import { users } from "../../db/schema";
import { getAccessToken } from "../../lib/oauth/tokens";

const userinfoRoute = new Hono<{
	Bindings: Env;
}>();

async function userinfo(c: Context<{ Bindings: Env }>) {
	const authorization = c.req.header("Authorization");

	let token: string | undefined;

	if (authorization) {
		const match = authorization.match(/^Bearer\s+(.+)$/i);

		if (!match) {
			return c.json(
				{
					error: "invalid_token",
				},
				401,
			);
		}

		token = match[1];
	} else if (c.req.method === "POST") {
		const contentType = c.req.header("Content-Type") ?? "";

		if (
			contentType.toLowerCase().startsWith("application/x-www-form-urlencoded")
		) {
			const body = await c.req.parseBody();

			if (typeof body.access_token === "string") {
				token = body.access_token;
			}
		}
	}

	if (!token) {
		return c.json(
			{
				error: "invalid_token",
			},
			401,
		);
	}

	const db = createDb(c.env.DB);

	const accessToken = await getAccessToken(db, token);

	if (!accessToken) {
		return c.json(
			{
				error: "invalid_token",
			},
			401,
		);
	}

	const result = await db
		.select({
			id: users.id,
			email: users.email,
			displayName: users.displayName,
			givenName: users.givenName,
			familyName: users.familyName,
			middleName: users.middleName,
			nickname: users.nickname,
			preferredUsername: users.preferredUsername,
			profileUrl: users.profileUrl,
			profileImageKey: users.profileImageKey,
			website: users.website,
			gender: users.gender,
			birthdate: users.birthdate,
			zoneinfo: users.zoneinfo,
			locale: users.locale,
			emailVerifiedAt: users.emailVerifiedAt,
			updatedAt: users.updatedAt,
		})
		.from(users)
		.where(eq(users.id, accessToken.userId))
		.limit(1);

	const user = result[0];

	if (!user) {
		return c.json(
			{
				error: "invalid_token",
			},
			401,
		);
	}

	const scopes = new Set(accessToken.scope.split(" ").filter(Boolean));

	const claims: Record<string, unknown> = {
		sub: user.id,
	};

	if (scopes.has("profile")) {
		if (user.displayName) {
			claims.name = user.displayName;
		}

		if (user.givenName) {
			claims.given_name = user.givenName;
		}

		if (user.familyName) {
			claims.family_name = user.familyName;
		}

		if (user.middleName) {
			claims.middle_name = user.middleName;
		}

		if (user.nickname) {
			claims.nickname = user.nickname;
		}

		if (user.preferredUsername) {
			claims.preferred_username = user.preferredUsername;
		}

		if (user.profileUrl) {
			claims.profile = user.profileUrl;
		}

		if (user.profileImageKey) {
			const origin = new URL(c.req.url).origin;

			claims.picture = `${origin}/oauth/avatar/${encodeURIComponent(user.id)}`;
		}

		if (user.website) {
			claims.website = user.website;
		}

		if (user.gender) {
			claims.gender = user.gender;
		}

		if (user.birthdate) {
			claims.birthdate = user.birthdate;
		}

		if (user.zoneinfo) {
			claims.zoneinfo = user.zoneinfo;
		}

		if (user.locale) {
			claims.locale = user.locale;
		}

		claims.updated_at = Math.floor(user.updatedAt / 1000);
	}

	if (scopes.has("email")) {
		claims.email = user.email;
		claims.email_verified = user.emailVerifiedAt !== null;
	}

	return c.json(claims);
}

userinfoRoute.get("/", userinfo);
userinfoRoute.post("/", userinfo);

export default userinfoRoute;
