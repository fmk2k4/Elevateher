import { getToken } from '@auth/core/jwt';

export function getBackendBaseUrl() {
	return (
		process.env.NEXT_PUBLIC_API_URL || process.env.VITE_API_URL || 'http://localhost:8000'
	).replace(/\/$/, '');
}

function isSecureRequest(request) {
	return process.env.AUTH_URL?.startsWith('https') ?? request.url?.startsWith('https') ?? false;
}

export async function getRawAccessToken(request) {
	return getToken({
		req: request,
		secret: process.env.AUTH_SECRET,
		secureCookie: isSecureRequest(request),
		raw: true,
	});
}

export async function proxyJsonToBackend(request, path, options = {}) {
	const token = await getRawAccessToken(request);
	if (!token) {
		return Response.json({ error: 'Unauthorized' }, { status: 401 });
	}

	const url = new URL(path, `${getBackendBaseUrl()}/`);
	const headers = {
		Authorization: `Bearer ${token}`,
		Accept: 'application/json',
		...options.headers,
	};

	if (options.body !== undefined && !headers['Content-Type']) {
		headers['Content-Type'] = 'application/json';
	}

	const response = await fetch(url, {
		method: options.method || request.method,
		headers,
		body: options.body,
		cache: 'no-store',
	});

	const contentType = response.headers.get('content-type') || 'application/json';
	const responseHeaders = new Headers();
	responseHeaders.set('Content-Type', contentType);

	if (!contentType.includes('application/json')) {
		const text = await response.text();
		return new Response(text, { status: response.status, headers: responseHeaders });
	}

	const text = await response.text();
	return new Response(text, { status: response.status, headers: responseHeaders });
}