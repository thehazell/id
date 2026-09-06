import { Hono } from "hono";
import { getCookie } from "hono/cookie";
import type { Context } from "hono";

import { createDb } from "../../db";
import {
	createAuthorizationCode,
	validateAuthorizationRequest,
	type AuthorizationRequest,
} from "../../lib/oauth/authorization";
import { getSessionUserWithSession } from "../../lib/session";

interface RequestObjectClaims {
	client_id?: string;
	redirect_uri?: string;
	response_type?: string | string[];
	scope?: string;
	state?: string;
	nonce?: string;
	prompt?: string;
	max_age?: number | string;
	acr_values?: string;
	claims?: string;
	code_challenge?: string;
	code_challenge_method?: string;
}

/**
 * Decodes and validates an unsigned OIDC Request Object.
 *
 * Maze ID currently supports only Request Objects using `alg: "none"`
 * with an empty signature.
 *
 * @param request - Compact JWT-formatted Request Object.
 * @returns The claims contained in the Request Object.
 * @throws If the Request Object is malformed or uses an unsupported algorithm.
 */
function decodeRequestObject(request: string): RequestObjectClaims {
	const parts = request.split(".");

	if (parts.length !== 3) {
		throw new Error("Invalid request object");
	}

	const [encodedHeader, encodedPayload, encodedSignature] = parts;

	if (encodedSignature !== "") {
		throw new Error("Request object must use an empty signature");
	}

	const header = JSON.parse(
		atob(encodedHeader.replace(/-/g, "+").replace(/_/g, "/")),
	) as { alg?: string };

	if (header.alg !== "none") {
		throw new Error("Unsupported request object algorithm");
	}

	const payload = JSON.parse(
		atob(encodedPayload.replace(/-/g, "+").replace(/_/g, "/")),
	) as RequestObjectClaims;

	return payload;
}

/**
 * Redirects the user agent to a validated OAuth redirect URI with an
 * authorization error.
 */
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

function getAuthorizationRequestFromQuery(c: Context<{ Bindings: Env }>): {
	request: AuthorizationRequest;
	prompt?: string;
	maxAge?: string;
} {
	const queryClientId = c.req.query("client_id");
	const queryRedirectUri = c.req.query("redirect_uri");
	const queryResponseType = c.req.query("response_type");
	const queryScope = c.req.query("scope");
	const queryState = c.req.query("state");
	const queryNonce = c.req.query("nonce");
	const queryPrompt = c.req.query("prompt");
	const queryMaxAge = c.req.query("max_age");
	const queryAcrValues = c.req.query("acr_values");
	const queryClaims = c.req.query("claims");
	const queryCodeChallenge = c.req.query("code_challenge");
	const queryCodeChallengeMethod = c.req.query("code_challenge_method");
	const requestObject = c.req.query("request");

	let requestClaims: RequestObjectClaims = {};

	if (requestObject) {
		requestClaims = decodeRequestObject(requestObject);
	}

	const clientId = requestClaims.client_id ?? queryClientId;
	const redirectUri = requestClaims.redirect_uri ?? queryRedirectUri;
	const responseType = requestClaims.response_type ?? queryResponseType;
	const scope = requestClaims.scope ?? queryScope;
	const state = requestClaims.state ?? queryState;
	const nonce = requestClaims.nonce ?? queryNonce;
	const prompt = requestClaims.prompt ?? queryPrompt;

	const maxAge =
		requestClaims.max_age !== undefined
			? String(requestClaims.max_age)
			: queryMaxAge;

	const acrValues =
		requestClaims.acr_values !== undefined
			? requestClaims.acr_values
			: queryAcrValues;

	const claims =
		requestClaims.claims !== undefined ? requestClaims.claims : queryClaims;

	const codeChallenge = requestClaims.code_challenge ?? queryCodeChallenge;

	const codeChallengeMethod =
		requestClaims.code_challenge_method ?? queryCodeChallengeMethod;

	const normalizedResponseType = Array.isArray(responseType)
		? responseType.join(" ")
		: responseType;

	return {
		request: {
			client_id: clientId ?? "",
			redirect_uri: redirectUri ?? "",
			response_type: normalizedResponseType ?? "",
			scope: scope ?? "",
			state,
			nonce,
			code_challenge: codeChallenge,
			code_challenge_method: codeChallengeMethod,
			acr_values: acrValues,
			claims,
		},
		prompt,
		maxAge,
	};
}

async function authorizeGet(c: Context<{ Bindings: Env }>) {
	const parsed = getAuthorizationRequestFromQuery(c);
	const { request, prompt, maxAge } = parsed;

	if (!request.client_id || !request.redirect_uri || !request.scope) {
		return c.json(
			{
				error: "invalid_request",
				error_description:
					"client_id, redirect_uri, and scope are required.",
			},
			400,
		);
	}

	if (!request.response_type) {
		return c.json(
			{
				error: "invalid_request",
				error_description: "The response_type parameter is required.",
			},
			400,
		);
	}

	if (maxAge !== undefined) {
		const parsedMaxAge = Number(maxAge);

		if (!Number.isInteger(parsedMaxAge) || parsedMaxAge < 0) {
			return c.json(
				{
					error: "invalid_request",
					error_description:
						"The max_age parameter must be a non-negative integer.",
				},
				400,
			);
		}
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

	const sessionRecord = sessionToken
		? await getSessionUserWithSession(db, sessionToken)
		: null;

	const authenticationAge = sessionRecord
		? Math.floor(Date.now() / 1000) -
			Math.floor(sessionRecord.session.createdAt / 1000)
		: null;

	const maxAgeExpired =
		maxAge !== undefined &&
		(authenticationAge === null || authenticationAge >= Number(maxAge));

	const requiresLogin = !sessionRecord || maxAgeExpired;

	if (requiresLogin && prompt === "none") {
		return redirectWithError(
			request.redirect_uri,
			"login_required",
			request.state,
		);
	}

	const authorizeUrl = new URL("https://id.hzel.org/authorize");

	authorizeUrl.searchParams.set("client_id", request.client_id);

	authorizeUrl.searchParams.set("redirect_uri", request.redirect_uri);

	authorizeUrl.searchParams.set("response_type", "code");

	authorizeUrl.searchParams.set("scope", validation.scopes.join(" "));

	if (request.state !== undefined) {
		authorizeUrl.searchParams.set("state", request.state);
	}

	if (request.nonce !== undefined) {
		authorizeUrl.searchParams.set("nonce", request.nonce);
	}

	if (request.acr_values !== undefined) {
		authorizeUrl.searchParams.set("acr_values", request.acr_values);
	}

	if (request.claims !== undefined) {
		authorizeUrl.searchParams.set("claims", request.claims);
	}

	if (requiresLogin) {
		authorizeUrl.searchParams.set("prompt", "login");
	} else if (prompt !== undefined) {
		authorizeUrl.searchParams.set("prompt", prompt);
	}

	if (maxAge !== undefined) {
		authorizeUrl.searchParams.set("max_age", maxAge);
	}

	if (request.code_challenge !== undefined) {
		authorizeUrl.searchParams.set("code_challenge", request.code_challenge);
	}

	if (request.code_challenge_method !== undefined) {
		authorizeUrl.searchParams.set(
			"code_challenge_method",
			request.code_challenge_method,
		);
	}

	return c.redirect(authorizeUrl.toString(), 302);
}

const authorize = new Hono<{
	Bindings: Env;
}>();

authorize.get("/", async (c) => {
	try {
		return await authorizeGet(c);
	} catch (error) {
		console.error("OAuth authorization error:", error);

		return c.json(
			{
				error: "server_error",
			},
			500,
		);
	}
});

authorize.post("/", async (c) => {
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

export default authorize;
