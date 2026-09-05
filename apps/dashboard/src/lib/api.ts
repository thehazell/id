import type {
	PublicKeyCredentialCreationOptionsJSON,
	PublicKeyCredentialRequestOptionsJSON,
} from "@simplewebauthn/browser";

const API_URL = import.meta.env.VITE_API_URL;

if (!API_URL) {
	throw new Error("VITE_API_URL is not configured");
}

export async function api<T>(
	path: string,
	options: RequestInit = {},
): Promise<T> {
	const response = await fetch(`${API_URL}${path}`, {
		...options,
		credentials: "include",
		headers: {
			...(options.body instanceof FormData
				? {}
				: { "Content-Type": "application/json" }),
			...options.headers,
		},
	});

	const data = await response.json().catch(() => null);

	if (!response.ok) {
		throw new Error(data?.error ?? "Something went wrong. Please try again.");
	}

	return data as T;
}

export interface AuthUser {
	id: string;
	email: string;
	displayName: string | null;
	profileImageKey: string | null;
	emailVerifiedAt: number | null;
	createdAt: number;
	isAdmin: boolean;
}

export interface AuthResponse {
	user: AuthUser;
}

export function login(email: string, password: string, rememberMe: boolean) {
	return api<AuthResponse>("/api/auth/login", {
		method: "POST",
		body: JSON.stringify({
			email,
			password,
			rememberMe,
		}),
	});
}

export function register(email: string, password: string) {
	return api<AuthResponse>("/api/auth/register", {
		method: "POST",
		body: JSON.stringify({
			email,
			password,
		}),
	});
}

export function logout() {
	return api<{ success: boolean }>("/api/auth/logout", {
		method: "POST",
	});
}

export function getCurrentUser() {
	return api<AuthResponse>("/api/auth/me");
}

export interface Session {
	id: string;
	createdAt: number;
	expiresAt: number;

	ipAddress: string | null;
	country: string | null;
	city: string | null;
	region: string | null;

	browser: string | null;
	os: string | null;

	current: boolean;
}

export interface SessionsResponse {
	sessions: Session[];
}

export function getSessions() {
	return api<SessionsResponse>("/api/auth/sessions");
}

export function revokeSession(id: string) {
	return api<{ success: boolean }>(`/api/auth/sessions/${id}/revoke`, {
		method: "POST",
	});
}

export function revokeAllOtherSessions() {
	return api<{ success: boolean }>("/api/auth/sessions/revoke-all", {
		method: "POST",
	});
}

export function changePassword(currentPassword: string, newPassword: string) {
	return api<{ success: boolean }>("/api/account/password", {
		method: "POST",
		body: JSON.stringify({
			currentPassword,
			newPassword,
		}),
	});
}

/**
 * Gets WebAuthn registration options for the current authenticated user.
 */
export function getPasskeyRegistrationOptions() {
	return api<PublicKeyCredentialCreationOptionsJSON>(
		"/api/passkeys/register/options",
		{
			method: "POST",
		},
	);
}

/**
 * Verifies a newly registered passkey.
 *
 * @param response The WebAuthn registration response.
 * @param name The display name for the passkey.
 */
export function verifyPasskeyRegistration(response: unknown, name: string) {
	return api<{ success: boolean }>("/api/passkeys/register/verify", {
		method: "POST",
		body: JSON.stringify({
			response,
			name,
		}),
	});
}

/**
 * WebAuthn authentication options plus the server-side
 * challenge record ID used to verify the authentication.
 */
export interface PasskeyLoginOptions
	extends PublicKeyCredentialRequestOptionsJSON {
	challengeId: string;
}

/**
 * Gets WebAuthn authentication options for usernameless passkey login.
 *
 * No email or username is required. The authenticator discovers
 * the appropriate passkey.
 */
export function getPasskeyLoginOptions() {
	return api<PasskeyLoginOptions>("/api/passkeys/login/options", {
		method: "POST",
	});
}

/**
 * Verifies a usernameless passkey login.
 *
 * @param response The WebAuthn authentication response.
 * @param challengeId The server-side authentication challenge ID.
 */
export function verifyPasskeyLogin(response: unknown, challengeId: string) {
	return api<AuthResponse>("/api/passkeys/login/verify", {
		method: "POST",
		body: JSON.stringify({
			response,
			challengeId,
		}),
	});
}

export interface Passkey {
	id: string;
	name: string | null;
	createdAt: number;
	lastUsedAt: number | null;
}

export interface PasskeysResponse {
	passkeys: Passkey[];
}

export function getPasskeys() {
	return api<PasskeysResponse>("/api/passkeys");
}

export function deletePasskey(id: string) {
	return api<{ success: boolean }>(`/api/passkeys/${id}`, {
		method: "DELETE",
	});
}

export function renamePasskey(id: string, name: string) {
	return api<{ success: boolean }>(`/api/passkeys/${id}`, {
		method: "PATCH",
		body: JSON.stringify({ name }),
	});
}

export function bootstrapAdmin(secret: string) {
	return api<{ success: boolean }>("/api/admin/bootstrap", {
		method: "POST",
		body: JSON.stringify({
			secret,
		}),
	});
}

export interface OAuthClient {
	id: string;
	name: string;
	clientType: "public" | "confidential";
	redirectUris: string[];
	scopes: string[];
	createdAt: number;
	updatedAt: number;
}

export interface OAuthClientsResponse {
	clients: OAuthClient[];
}

export interface OAuthClientResponse {
	client_id: string;
	client_secret?: string;
	name: string;
	client_type: "public" | "confidential";
	redirect_uris: string[];
	scopes: string[];
	created_at?: number;
	updated_at?: number;
}

export function getOAuthClients() {
	return api<OAuthClientsResponse>("/oauth/clients");
}

export function createOAuthClient(input: {
	name: string;
	clientType: "public" | "confidential";
	redirectUris: string[];
	scopes: string[];
}) {
	return api<OAuthClientResponse>("/oauth/clients", {
		method: "POST",
		body: JSON.stringify(input),
	});
}

export function updateOAuthClient(
	clientId: string,
	input: {
		name: string;
		redirectUris: string[];
		scopes: string[];
	},
) {
	return api<OAuthClientResponse>(`/oauth/clients/${clientId}`, {
		method: "PATCH",
		body: JSON.stringify(input),
	});
}

export function deleteOAuthClient(clientId: string) {
	return api<{ success: boolean }>(`/oauth/clients/${clientId}`, {
		method: "DELETE",
	});
}

export function updateProfile(displayName: string) {
	return api<{ success: boolean }>("/api/account/profile", {
		method: "PATCH",
		body: JSON.stringify({
			displayName,
		}),
	});
}

export function uploadProfileAvatar(file: File) {
	const formData = new FormData();
	formData.append("file", file);

	return api<{ success: boolean }>("/api/account/profile/avatar", {
		method: "PUT",
		body: formData,
	});
}

export function deleteProfileAvatar() {
	return api<{ success: boolean }>("/api/account/profile/avatar", {
		method: "DELETE",
	});
}

export function getProfileAvatarUrl() {
	return `${API_URL}/api/account/profile/avatar`;
}

export interface OAuthGrant {
	clientId: string;
	clientName: string;
	scopes: string[];
	grantedAt: number;
}

export interface OAuthGrantsResponse {
	grants: OAuthGrant[];
}

export function getOAuthGrants() {
	return api<OAuthGrantsResponse>("/api/account/oauth/grants");
}

export function revokeOAuthGrant(clientId: string) {
	return api<{ success: boolean }>(`/api/account/oauth/grants/${clientId}`, {
		method: "DELETE",
	});
}

export interface OAuthClientDetails {
	client_id: string;
	name: string;
}

export function getOAuthClientDetails(clientId: string) {
	return api<OAuthClientDetails>(
		`/oauth/details?client_id=${encodeURIComponent(clientId)}`,
	);
}
