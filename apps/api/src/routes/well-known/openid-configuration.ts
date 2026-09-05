import { Hono } from "hono";

const discoveryRoute = new Hono<{
	Bindings: Env;
}>();

discoveryRoute.get("/", (c) => {
	const issuer = c.env.OIDC_ISSUER;

	return c.json({
		issuer,

		authorization_endpoint: `${issuer}/oauth/authorize`,

		token_endpoint: `${issuer}/oauth/token`,

		userinfo_endpoint: `${issuer}/oauth/userinfo`,

		jwks_uri: `${issuer}/.well-known/jwks.json`,

		response_types_supported: ["code"],

		subject_types_supported: ["public"],

		id_token_signing_alg_values_supported: ["ES256"],

		acr_values_supported: ["urn:maze-id:password", "urn:maze-id:passkey"],

		scopes_supported: ["openid", "profile", "email"],

		claims_supported: [
			"iss",
			"sub",
			"aud",
			"exp",
			"iat",
			"nonce",
			"acr",
			"name",
			"email",
			"email_verified",
			"profile",
		],

		grant_types_supported: ["authorization_code"],

		token_endpoint_auth_methods_supported: [
			"none",
			"client_secret_basic",
			"client_secret_post",
		],

		code_challenge_methods_supported: ["S256"],

		request_object_signing_alg_values_supported: ["none"],

		request_parameter_supported: true,
	});
});

export default discoveryRoute;
