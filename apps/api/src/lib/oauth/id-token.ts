import { getKeyId, importPrivateKey, sign } from "./keys";

import { base64UrlEncode } from "../base64";

const encoder = new TextEncoder();

interface CreateIdTokenInput {
	privateKey: string;
	issuer: string;
	clientId: string;
	userId: string;
	nonce?: string | null;
	expiresIn: number;

	email?: string;
	emailVerified?: boolean;
	displayName?: string | null;
	preferredUsername?: string | null;
}

function encodeJson(value: unknown) {
	return base64UrlEncode(encoder.encode(JSON.stringify(value)));
}

/**
 * Creates a signed OIDC ID token.
 *
 * @param input The ID token configuration and claims.
 * @returns The signed JWT.
 */
export async function createIdToken(input: CreateIdTokenInput) {
	const now = Math.floor(Date.now() / 1000);

	const header = {
		alg: "ES256",
		typ: "JWT",
		kid: getKeyId(),
	};

	const payload: Record<string, unknown> = {
		iss: input.issuer,
		sub: input.userId,
		aud: input.clientId,
		iat: now,
		exp: now + input.expiresIn,
	};

	if (input.email) {
		payload.email = input.email;
	}

	if (input.emailVerified !== undefined) {
		payload.email_verified = input.emailVerified;
	}

	if (input.displayName) {
		payload.name = input.displayName;
	}

	if (input.preferredUsername) {
		payload.preferred_username = input.preferredUsername;
	}

	if (input.nonce) {
		payload.nonce = input.nonce;
	}

	const encodedHeader = encodeJson(header);
	const encodedPayload = encodeJson(payload);
	const signingInput = encoder.encode(`${encodedHeader}.${encodedPayload}`);

	const privateKey = await importPrivateKey(input.privateKey);
	const signature = await sign(privateKey, signingInput);
	const encodedSignature = base64UrlEncode(new Uint8Array(signature));

	return `${encodedHeader}.${encodedPayload}.${encodedSignature}`;
}
