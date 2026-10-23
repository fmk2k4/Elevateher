export async function GET(request) {
	const authHeader = request.headers.get("Authorization");
	const token = authHeader && authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

	if (!token) {
		return new Response(JSON.stringify({ error: 'Unauthorized' }), {
			status: 401,
			headers: {
				'Content-Type': 'application/json',
			},
		});
	}

	// Decode JWT payload (no verification — FastAPI verifies the signature)
	let user = { id: null, email: null, name: null };
	try {
		const payloadBase64 = token.split(".")[1];
		const payload = JSON.parse(atob(payloadBase64));
		user = { id: payload.sub, email: payload.email, name: payload.name };
	} catch {}

	return new Response(
		JSON.stringify({
			jwt: token,
			user,
		}),
		{
			headers: {
				'Content-Type': 'application/json',
			},
		}
	);
}
