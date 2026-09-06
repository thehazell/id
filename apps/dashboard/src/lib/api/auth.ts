import { api } from "./client";

export interface AuthUser {
	id: string;

	email: string;

	displayName: string | null;
	givenName: string | null;
	familyName: string | null;
	middleName: string | null;
	nickname: string | null;
	preferredUsername: string | null;

	profileUrl: string | null;
	profileImageKey: string | null;
	website: string | null;

	gender: string | null;
	birthdate: string | null;
	zoneinfo: string | null;
	locale: string | null;

	emailVerifiedAt: number | null;

	createdAt: number;
	isAdmin: boolean;
}

export interface AuthResponse {
	user: AuthUser;
}

export function login(
	email: string,
	password: string,
	rememberMe: boolean,
	prompt?: string,
) {
	return api<AuthResponse>("/api/auth/login", {
		method: "POST",
		body: JSON.stringify({
			email,
			password,
			rememberMe,
			prompt,
		}),
	});
}

export function register(email: string, password: string) {
	return api<AuthResponse>("/api/auth/register", {
		method: "POST",
		body: JSON.stringify({ email, password }),
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
