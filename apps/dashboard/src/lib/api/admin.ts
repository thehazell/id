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
	profileImageKey: string | null;
	emailVerifiedAt: number | null;
	createdAt: number;
	isAdmin: boolean;
}

export interface UsersResponse {
	users: AdminUser[];
}

export function getUsers() {
	return api<UsersResponse>("/api/admin/users");
}