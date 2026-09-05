import { Hono } from "hono";
import { getCookie } from "hono/cookie";

import { createDb } from "../../db";
import {
	clientSupportsScopes,
	getOAuthClient,
	validateRedirectUri,
} from "../../lib/oauth/client";
import { getSession } from "../../lib/session";

interface RequestObjectClaims {
	client_id?: string;
	redirect_uri?: string;
	response_type?: string | string[];
	scope?: string;
	state?: string;
	nonce?: string;
	prompt?: string;
	max_age?: number | string;
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
 *
 * @param redirectUri - The client's validated redirect URI.
 * @param error - OAuth/OIDC error code.
 * @param state - Optional state value from the authorization request.
 * @param errorDescription - Optional human-readable error description.
 * @returns A 302 redirect response.
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

const authorize = new Hono<{ Bindings: Env }>();

authorize.get("/", async (c) => {
	try {
		const queryClientId = c.req.query("client_id");
		const queryRedirectUri = c.req.query("redirect_uri");
		const queryResponseType = c.req.query("response_type");
		const queryScope = c.req.query("scope");
		const queryState = c.req.query("state");
		const queryNonce = c.req.query("nonce");
		const queryPrompt = c.req.query("prompt");
		const queryMaxAge = c.req.query("max_age");
		const queryCodeChallenge = c.req.query("code_challenge");
		const queryCodeChallengeMethod = c.req.query("code_challenge_method");
		const request = c.req.query("request");

		let requestClaims: RequestObjectClaims = {};

		if (request) {
			requestClaims = decodeRequestObject(request);
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
		const codeChallenge = requestClaims.code_challenge ?? queryCodeChallenge;
		const codeChallengeMethod =
			requestClaims.code_challenge_method ?? queryCodeChallengeMethod;

		if (!clientId || !redirectUri || !scope) {
			return c.json(
				{
					error: "invalid_request",
					error_description: "client_id, redirect_uri, and scope are required.",
				},
				400,
			);
		}

		if (!responseType) {
			return c.json(
				{
					error: "invalid_request",
					error_description: "The response_type parameter is required.",
				},
				400,
			);
		}

		const normalizedResponseTypes = Array.isArray(responseType)
			? responseType
			: responseType.split(" ").filter(Boolean);

		if (
			normalizedResponseTypes.length !== 1 ||
			normalizedResponseTypes[0] !== "code"
		) {
			return c.json(
				{
					error: "unsupported_response_type",
					error_description: "Only the code response type is supported.",
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

		if (codeChallenge || codeChallengeMethod) {
			if (!codeChallenge || !codeChallengeMethod) {
				return c.json(
					{
						error: "invalid_request",
						error_description:
							"Both code_challenge and code_challenge_method are required.",
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
		}

		const db = createDb(c.env.DB);

		const client = await getOAuthClient(db, clientId);

		if (!client) {
			return c.json(
				{
					error: "invalid_client",
				},
				400,
			);
		}

		if (!validateRedirectUri(client, redirectUri)) {
			return c.json(
				{
					error: "invalid_request",
					error_description: "Invalid redirect_uri.",
				},
				400,
			);
		}

		const scopes = [...new Set(scope.split(" ").filter(Boolean))];

		if (!scopes.includes("openid")) {
			return redirectWithError(
				redirectUri,
				"invalid_scope",
				state,
				"The openid scope is required.",
			);
		}

		if (!clientSupportsScopes(client, scopes)) {
			return redirectWithError(
				redirectUri,
				"invalid_scope",
				state,
				"One or more requested scopes are not supported by the client.",
			);
		}

		const sessionToken = getCookie(c, "session");
		const session = sessionToken ? await getSession(db, sessionToken) : null;

		/*
		 * `session.createdAt` represents the time of the most recent
		 * authentication because reauthentication creates a new session.
		 *
		 * This check MUST happen on the authorization server rather than
		 * relying on the dashboard to enforce `max_age`.
		 */
		const authenticationAge = session
			? Math.floor(Date.now() / 1000) - Math.floor(session.createdAt / 1000)
			: null;

		const maxAgeExpired =
			maxAge !== undefined &&
			(authenticationAge === null || authenticationAge >= Number(maxAge));

		const requiresLogin = !session || maxAgeExpired;

		/*
		 * `prompt=none` forbids user interaction. If the user is not
		 * authenticated or their authentication is older than `max_age`,
		 * authorization must fail without displaying a login screen.
		 */
		if (requiresLogin && prompt === "none") {
			return redirectWithError(redirectUri, "login_required", state);
		}

		const authorizeUrl = new URL("https://id.hzel.org/authorize");

		authorizeUrl.searchParams.set("client_id", clientId);
		authorizeUrl.searchParams.set("redirect_uri", redirectUri);
		authorizeUrl.searchParams.set("response_type", "code");
		authorizeUrl.searchParams.set("scope", scopes.join(" "));

		if (state !== undefined) {
			authorizeUrl.searchParams.set("state", state);
		}

		if (nonce !== undefined) {
			authorizeUrl.searchParams.set("nonce", nonce);
		}

		/*
		 * If max_age has expired, force the login UI to perform
		 * reauthentication. The server will verify the resulting new
		 * authentication when this authorization request is processed again.
		 */
		if (requiresLogin) {
			authorizeUrl.searchParams.set("prompt", "login");
		} else if (prompt !== undefined) {
			authorizeUrl.searchParams.set("prompt", prompt);
		}

		if (maxAge !== undefined) {
			authorizeUrl.searchParams.set("max_age", maxAge);
		}

		if (codeChallenge !== undefined) {
			authorizeUrl.searchParams.set("code_challenge", codeChallenge);
		}

		if (codeChallengeMethod !== undefined) {
			authorizeUrl.searchParams.set(
				"code_challenge_method",
				codeChallengeMethod,
			);
		}

		return c.redirect(authorizeUrl.toString(), 302);
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

export default authorize;
