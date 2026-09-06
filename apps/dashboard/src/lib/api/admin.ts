import { api } from "./client";

export function bootstrapAdmin(secret: string) {
	return api<{ success: boolean }>("/api/admin/bootstrap", {
		method: "POST",
		body: JSON.stringify({ secret }),
	});
}

export interface AdminUser {
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
	isAdmin: boolean;
	disabledAt: number | null;

	createdAt: number;
	updatedAt: number;
}

export interface UsersResponse {
	users: AdminUser[];
}

export function getUsers(): Promise<UsersResponse> {
	return api<UsersResponse>("/api/admin/users");
}
