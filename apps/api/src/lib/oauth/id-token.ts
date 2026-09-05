import { getKeyId, importPrivateKey, sign } from "./keys";

import { base64UrlEncode } from "../base64";

const encoder = new TextEncoder();

function encodeJson(value: unknown) {
	return base64UrlEncode(encoder.encode(JSON.stringify(value)));
}

interface CreateIdTokenInput {
	issuer: string;
	userId: string;
	clientId: string;
	expiresIn: number;
	nonce?: string;
	privateKey: string;
}

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
