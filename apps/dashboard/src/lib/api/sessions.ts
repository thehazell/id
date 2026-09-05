import { api } from "./client";

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
