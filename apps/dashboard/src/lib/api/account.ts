import { api, API_URL } from "./client";

export function changePassword(currentPassword: string, newPassword: string) {
	return api<{ success: boolean }>("/api/account/password", {
		method: "POST",
		body: JSON.stringify({ currentPassword, newPassword }),
	});
}

export function updateProfile(displayName: string) {
	return api<{ success: boolean }>("/api/account/profile", {
		method: "PATCH",
		body: JSON.stringify({ displayName }),
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
	return api<{ success: boolean }>(
		`/api/account/oauth/grants/${clientId}`,
		{
			method: "DELETE",
		},
	);
}