import { Hono } from "hono";
import { getCookie } from "hono/cookie";

import { createDb } from "@/db";
import {
	createAuthorizationCode,
	validateAuthorizationRequest,
	type AuthorizationRequest,
} from "@/lib/oauth/authorization";
import { getSessionUserWithSession } from "@/lib/session";

const route = new Hono<{ Bindings: Env }>();

route.post("/", async (c) => {
	try {
		const form = await c.req.parseBody();

		const getString = (value: unknown) =>
			typeof value === "string" ? value : undefined;

		const request: AuthorizationRequest = {
			client_id: getString(form.client_id) ?? "",
			redirect_uri: getString(form.redirect_uri) ?? "",
			response_type: getString(form.response_type) ?? "",
			scope: getString(form.scope) ?? "",
			state: getString(form.state),
			nonce: getString(form.nonce),
			code_challenge: getString(form.code_challenge),
			code_challenge_method: getString(form.code_challenge_method),
			acr_values: getString(form.acr_values),
			claims: getString(form.claims),
		};

		if (
			!request.client_id ||
			!request.redirect_uri ||
			!request.response_type ||
			!request.scope
		) {
			return c.json(
				{
					error: "invalid_request",
					error_description:
						"client_id, redirect_uri, response_type, and scope are required.",
				},
				400,
			);
		}

		const db = createDb(c.env.DB);

		const validation = await validateAuthorizationRequest(db, request);

		if ("error" in validation) {
			return c.json(
				{
					error: validation.error,
					error_description: validation.error_description,
				},
				400,
			);
		}

		const sessionToken = getCookie(c, "session");

		if (!sessionToken) {
			return redirectWithError(
				request.redirect_uri,
				"login_required",
				request.state,
			);
		}

		const sessionRecord = await getSessionUserWithSession(db, sessionToken);

		if (!sessionRecord) {
			return redirectWithError(
				request.redirect_uri,
				"login_required",
				request.state,
			);
		}

		const { user, session } = sessionRecord;

		const code = await createAuthorizationCode(
			db,
			request,
			validation.client.id,
			validation.scopes,
			user.id,
			Math.floor(session.createdAt / 1000),
		);

		const location = new URL(request.redirect_uri);

		location.searchParams.set("code", code);

		if (request.state !== undefined) {
			location.searchParams.set("state", request.state);
		}

		return c.redirect(location.toString(), 302);
	} catch (error) {
		console.error("OAuth authorization POST error:", error);

		return c.json(
			{
				error: "server_error",
			},
			500,
		);
	}
});

function redirectWithError(
	redirectUri: string,
	error: string,
	state?: string,
	errorDescription?: string,
) {
	const url = new URL(redirectUri);

	url.searchParams.set("error", error);

	if (errorDescription) {
		url.searchParams.set("error_description", errorDescription);
	}

	if (state) {
		url.searchParams.set("state", state);
	}

	return Response.redirect(url.toString(), 302);
}

export default route;
