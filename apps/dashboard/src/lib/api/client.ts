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

export { API_URL };
