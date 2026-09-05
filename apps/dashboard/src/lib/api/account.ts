import { api, API_URL } from "./client";

export function changePassword(currentPassword: string, newPassword: string) {
	return api<{ success: boolean }>("/api/account/password", {
		method: "POST",
		body: JSON.stringify({ currentPassword, newPassword }),
	});
}

export interface UpdateProfileInput {
	displayName?: string;
	givenName?: string;
	familyName?: string;
	middleName?: string;
	nickname?: string;
	preferredUsername?: string;
	profileUrl?: string;
	website?: string;
	gender?: string;
	birthdate?: string;
	zoneinfo?: string;
	locale?: string;
}

export function updateProfile(profile: UpdateProfileInput) {
	return api<{ success: boolean }>("/api/account/profile", {
		method: "PATCH",
		body: JSON.stringify(profile),
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
