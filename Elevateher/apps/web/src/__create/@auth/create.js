import { getToken } from '@auth/core/jwt';
import { getContext } from 'hono/context-storage';
import { jwtVerify } from 'jose';

export default function CreateAuth() {
	const auth = async () => {
		const c = getContext();
		const token = await getToken({
			req: c.req.raw,
			secret: process.env.AUTH_SECRET,
			secureCookie: process.env.AUTH_URL?.startsWith('https') ?? false,
			decode: async ({ secret, token }) => {
				if (!token) return null;
				const secretEncoded = new TextEncoder().encode(secret);
				try {
					const { payload } = await jwtVerify(token, secretEncoded);
					return payload;
				} catch (e) {
					return null;
				}
			}
		});
		if (token) {
			return {
				user: {
					id: token.sub,
					email: token.email,
					name: token.name,
					image: token.picture,
				},
				expires: token.exp.toString(),
			};
		}
	};
	return {
		auth,
	};
}
