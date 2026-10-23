import type { Config } from '@react-router/dev/config';

export default {
	appDirectory: './src/app',
	ssr: true,
	prerender: ['/*?'],
	future: {
		// Opt-in to v8 migration flags early for clean upgrade path
		// These stabilize in React Router v8; opting in now avoids
		// deprecation warnings and ensures the app is ready for v8.
		v8_middleware: true,
		v8_splitRouteModules: true,
		v8_passThroughRequests: true,
		v8_trailingSlashAwareDataRequests: true,
	},
} satisfies Config;