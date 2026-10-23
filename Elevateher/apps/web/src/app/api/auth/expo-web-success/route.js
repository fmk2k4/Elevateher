export async function GET(request) {
	const authHeader = request.headers.get("Authorization");
	const token = authHeader && authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

	if (!token) {
		return new Response(
			`
			<html>
				<body>
					<script>
						window.parent.postMessage({ type: 'AUTH_ERROR', error: 'Unauthorized' }, '*');
					</script>
				</body>
			</html>
			`,
			{
				status: 401,
				headers: {
					'Content-Type': 'text/html',
				},
			}
		);
	}

	// Decode JWT payload (no verification — FastAPI verifies the signature)
	let user = { id: null, email: null, name: null };
	try {
		const payloadBase64 = token.split(".")[1];
		const payload = JSON.parse(atob(payloadBase64));
		user = { id: payload.sub, email: payload.email, name: payload.name };
	} catch {}

	const message = {
		type: 'AUTH_SUCCESS',
		jwt: token,
		user,
	};

	return new Response(
		`
		<html>
			<body>
				<script>
					window.parent.postMessage(${JSON.stringify(message)}, '*');
				</script>
			</body>
		</html>
		`,
		{
			headers: {
				'Content-Type': 'text/html',
			},
		}
	);
}
