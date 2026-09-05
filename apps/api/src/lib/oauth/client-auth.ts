export function getBasicClientCredentials(authorization: string | undefined) {
	if (!authorization) {
		return null;
	}

	const spaceIndex = authorization.indexOf(" ");

	if (spaceIndex === -1) {
		return null;
	}

	const scheme = authorization.slice(0, spaceIndex);

	if (scheme.toLowerCase() !== "basic") {
		return null;
	}

	const encoded = authorization.slice(spaceIndex + 1).trim();

	if (!encoded) {
		return null;
	}

	try {
		const decoded = atob(encoded);
		const separator = decoded.indexOf(":");

		if (separator === -1) {
			return null;
		}

		const username = decoded.slice(0, separator);
		const password = decoded.slice(separator + 1);

		return {
			clientId: decodeURIComponent(username.replaceAll("+", " ")),
			clientSecret: decodeURIComponent(password.replaceAll("+", " ")),
		};
	} catch {
		return null;
	}
}
