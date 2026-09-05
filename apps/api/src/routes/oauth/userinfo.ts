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
			contentType
				.toLowerCase()
				.startsWith("application/x-www-form-urlencoded")
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
			emailVerifiedAt: users.emailVerifiedAt,
			profileImageKey: users.profileImageKey,
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
		claims.name = user.displayName ?? undefined;
		claims.preferred_username = user.email.split("@")[0];

		if (user.profileImageKey) {
			const origin = new URL(c.req.url).origin;

			claims.picture = `${origin}/oauth/avatar/${encodeURIComponent(
				user.id,
			)}`;
		}
	}

	if (scopes.has("email")) {
		claims.email = user.email;
		claims.email_verified = user.emailVerifiedAt !== null;
	}

	return c.json(claims, 200);
}

userinfoRoute.get("/", userinfo);
userinfoRoute.post("/", userinfo);

export default userinfoRoute;
