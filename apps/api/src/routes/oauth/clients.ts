import { Hono } from "hono";

import { createDb } from "../../db";
import {
	createOAuthClient,
	deleteOAuthClient,
	getOAuthClient,
	getOAuthClients,
	isOAuthClientType,
	OIDC_SCOPES,
	updateOAuthClient,
} from "../../lib/oauth/client";
import { hashToken } from "../../lib/token";
import { requireAdmin } from "../../middleware/auth";

const clientsRoute = new Hono<{
	Bindings: Env;
}>();

clientsRoute.get("/", requireAdmin, async (c) => {
	const db = createDb(c.env.DB);
	const clients = await getOAuthClients(db);

	return c.json({
		clients: clients.map((client) => ({
			id: client.id,
			name: client.name,
			clientType: client.clientType,
			redirectUris: client.redirectUris,
			scopes: client.scopes,
			createdAt: client.createdAt,
			updatedAt: client.updatedAt,
		})),
	});
});

clientsRoute.post("/", requireAdmin, async (c) => {
	const body = await c.req.json<{
		name: string;
		clientType: string;
		redirectUris: string[];
		scopes: string[];
	}>();

	if (
		!body.name ||
		!isOAuthClientType(body.clientType) ||
		!Array.isArray(body.redirectUris) ||
		!Array.isArray(body.scopes)
	) {
		return c.json(
			{
				error: "invalid_request",
			},
			400,
		);
	}

	if (
		body.scopes.some(
			(scope) =>
				!OIDC_SCOPES.includes(scope as (typeof OIDC_SCOPES)[number]),
		)
	) {
		return c.json(
			{
				error: "invalid_scope",
			},
			400,
		);
	}

	if (!body.scopes.includes("openid")) {
		return c.json(
			{
				error: "openid_required",
			},
			400,
		);
	}

	let clientSecret: string | undefined;
	let clientSecretHash: string | undefined;

	if (body.clientType === "confidential") {
		clientSecret = crypto.randomUUID();
		clientSecretHash = await hashToken(clientSecret);
	}

	const db = createDb(c.env.DB);

	const client = await createOAuthClient(db, {
		name: body.name,
		clientType: body.clientType,
		clientSecretHash,
		redirectUris: body.redirectUris,
		scopes: body.scopes,
	});

	return c.json(
		{
			client_id: client?.id,
			client_secret: clientSecret,
			name: client?.name,
			client_type: client?.clientType,
			redirect_uris: client?.redirectUris,
			scopes: client?.scopes,
		},
		201,
	);
});

clientsRoute.patch("/:id", requireAdmin, async (c) => {
	const body = await c.req.json<{
		name: string;
		redirectUris: string[];
		scopes: string[];
	}>();

	if (
		!body.name ||
		!Array.isArray(body.redirectUris) ||
		!Array.isArray(body.scopes)
	) {
		return c.json(
			{
				error: "invalid_request",
			},
			400,
		);
	}

	if (
		body.scopes.some(
			(scope) =>
				!OIDC_SCOPES.includes(scope as (typeof OIDC_SCOPES)[number]),
		)
	) {
		return c.json(
			{
				error: "invalid_scope",
			},
			400,
		);
	}

	if (!body.scopes.includes("openid")) {
		return c.json(
			{
				error: "openid_required",
			},
			400,
		);
	}

	const clientId = c.req.param("id");

	if (!clientId) {
		return c.json(
			{
				error: "client_not_found",
			},
			404,
		);
	}

	const db = createDb(c.env.DB);
	const existing = await getOAuthClient(db, clientId);

	if (!existing) {
		return c.json(
			{
				error: "client_not_found",
			},
			404,
		);
	}

	const client = await updateOAuthClient(db, existing.id, {
		name: body.name.trim(),
		redirectUris: body.redirectUris,
		scopes: body.scopes,
	});

	return c.json({
		client_id: client?.id,
		name: client?.name,
		client_type: client?.clientType,
		redirect_uris: client?.redirectUris,
		scopes: client?.scopes,
		created_at: client?.createdAt,
		updated_at: client?.updatedAt,
	});
});

clientsRoute.delete("/:id", requireAdmin, async (c) => {
	const clientId = c.req.param("id");

	if (!clientId) {
		return c.json(
			{
				error: "client_not_found",
			},
			404,
		);
	}

	const db = createDb(c.env.DB);
	const client = await deleteOAuthClient(db, clientId);

	if (!client) {
		return c.json(
			{
				error: "client_not_found",
			},
			404,
		);
	}

	return c.body(null, 204);
});

export default clientsRoute;
