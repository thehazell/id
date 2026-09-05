import { Hono } from "hono";

import { createDb } from "../../db";
import {
	clientSupportsScopes,
	getOAuthClient,
	validateRedirectUri,
} from "../../lib/oauth/client";

const authorizeRoute = new Hono<{
	Bindings: Env;
}>();

interface RequestObjectClaims {
	client_id?: string;
	redirect_uri?: string;
	response_type?: string | string[];
	scope?: string;
	state?: string;
	nonce?: string;
	prompt?: string;
	code_challenge?: string;
	code_challenge_method?: string;
}

function decodeRequestObject(request: string): RequestObjectClaims {
	const parts = request.split(".");

	if (parts.length !== 3) {
		throw new Error("Invalid request object.");
	}

	const [encodedHeader, encodedPayload, encodedSignature] = parts;

	if (!encodedHeader || !encodedPayload || encodedSignature === undefined) {
		throw new Error("Invalid request object.");
	}

	const header = JSON.parse(
		atob(encodedHeader.replace(/-/g, "+").replace(/_/g, "/")),
	) as {
		alg?: string;
	};

	if (header.alg !== "none") {
		throw new Error("Unsupported request object signing algorithm.");
	}

	if (encodedSignature !== "") {
		throw new Error("Unsigned request object must not contain a signature.");
	}

	return JSON.parse(
		atob(encodedPayload.replace(/-/g, "+").replace(/_/g, "/")),
	) as RequestObjectClaims;
}

authorizeRoute.get("/", async (c) => {
	try {
		/**
		 * Read normal authorization request parameters.
		 */
		const queryClientId = c.req.query("client_id");
		const queryRedirectUri = c.req.query("redirect_uri");
		const queryResponseType = c.req.query("response_type");
		const queryScope = c.req.query("scope");
		const queryState = c.req.query("state");
		const queryNonce = c.req.query("nonce");
		const queryPrompt = c.req.query("prompt");
		const queryCodeChallenge = c.req.query("code_challenge");
		const queryCodeChallengeMethod = c.req.query("code_challenge_method");

		const requestObject = c.req.query("request");

		/**
		 * Parse the Request Object if one was supplied.
		 *
		 * Request Object parameters take precedence over
		 * corresponding parameters supplied in the query.
		 */
		let requestClaims: RequestObjectClaims = {};

		if (requestObject) {
			try {
				requestClaims = decodeRequestObject(requestObject);
			} catch {
				return c.json(
					{
						error: "invalid_request",
						error_description: "Invalid request object.",
					},
					400,
				);
			}
		}

		/**
		 * Resolve parameters.
		 *
		 * Request Object values take precedence over query parameters.
		 */
		const clientId = requestClaims.client_id ?? queryClientId;

		const redirectUri = requestClaims.redirect_uri ?? queryRedirectUri;

		const responseType =
			typeof requestClaims.response_type === "string"
				? requestClaims.response_type
				: Array.isArray(requestClaims.response_type)
					? requestClaims.response_type.join(" ")
					: queryResponseType;

		const scope = requestClaims.scope ?? queryScope;
		const state = requestClaims.state ?? queryState;
		const nonce = requestClaims.nonce ?? queryNonce;
		const prompt = requestClaims.prompt ?? queryPrompt;

		const codeChallenge = requestClaims.code_challenge ?? queryCodeChallenge;

		const codeChallengeMethod =
			requestClaims.code_challenge_method ?? queryCodeChallengeMethod;

		/**
		 * response_type is required.
		 */
		if (!responseType) {
			return c.json(
				{
					error: "invalid_request",
					error_description: "The response_type parameter is required.",
				},
				400,
			);
		}

		/**
		 * Maze ID currently supports only the authorization code flow.
		 */
		if (responseType !== "code") {
			return c.json(
				{
					error: "unsupported_response_type",
					error_description: "Only the code response type is supported.",
				},
				400,
			);
		}

		/**
		 * Required authorization request parameters.
		 */
		if (!clientId) {
			return c.json(
				{
					error: "invalid_request",
					error_description: "The client_id parameter is required.",
				},
				400,
			);
		}

		if (!redirectUri) {
			return c.json(
				{
					error: "invalid_request",
					error_description: "The redirect_uri parameter is required.",
				},
				400,
			);
		}

		if (!scope) {
			return c.json(
				{
					error: "invalid_request",
					error_description: "The scope parameter is required.",
				},
				400,
			);
		}

		/**
		 * Validate PKCE when supplied.
		 *
		 * PKCE is optional for this authorization request. If either
		 * parameter is supplied, both must be present and the method
		 * must be S256.
		 */
		if (codeChallenge || codeChallengeMethod) {
			if (!codeChallenge) {
				return c.json(
					{
						error: "invalid_request",
						error_description: "The code_challenge parameter is required.",
					},
					400,
				);
			}

			if (!codeChallengeMethod) {
				return c.json(
					{
						error: "invalid_request",
						error_description:
							"The code_challenge_method parameter is required.",
					},
					400,
				);
			}

			if (codeChallengeMethod !== "S256") {
				return c.json(
					{
						error: "invalid_request",
						error_description:
							"Only the S256 code challenge method is supported.",
					},
					400,
				);
			}
		}

		/**
		 * Load the client.
		 */
		const db = createDb(c.env.DB);
		const client = await getOAuthClient(db, clientId);

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
		 * Validate the redirect URI.
		 *
		 * redirectUri has already been resolved above, with the
		 * Request Object taking precedence over the query parameter.
		 */
		if (!validateRedirectUri(client, redirectUri)) {
			return c.json(
				{
					error: "invalid_redirect_uri",
					error_description: "Invalid redirect URI.",
				},
				400,
			);
		}

		/**
		 * Parse and normalize scopes.
		 */
		const scopes = [...new Set(scope.split(" ").filter(Boolean))];

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
		 * Build the dashboard authorization request.
		 */
		const params = new URLSearchParams();

		params.set("client_id", client.id);
		params.set("redirect_uri", redirectUri);
		params.set("response_type", responseType);
		params.set("scope", scopes.join(" "));

		if (codeChallenge) {
			params.set("code_challenge", codeChallenge);
		}

		if (codeChallengeMethod) {
			params.set("code_challenge_method", codeChallengeMethod);
		}

		if (state) {
			params.set("state", state);
		}

		if (nonce) {
			params.set("nonce", nonce);
		}

		if (prompt) {
			params.set("prompt", prompt);
		}

		const authorizeUrl = new URL(
			"/authorize",
			`https://${c.env.DASHBOARD_DOMAIN}`,
		);

		authorizeUrl.search = params.toString();

		return c.redirect(authorizeUrl.toString(), 302);
	} catch (error) {
		console.error("OAuth authorization request failed:", error);

		return c.json(
			{
				error: "server_error",
				error_description: "The authorization request could not be processed.",
			},
			500,
		);
	}
});

export default authorizeRoute;
