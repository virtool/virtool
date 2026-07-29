export const SENTRY_DSN_ENV = "VT_SENTRY_DSN";

type ImportMetaEnv = Record<string, string | undefined>;

export function readDsn(env: ImportMetaEnv): string | undefined {
	const value = env[SENTRY_DSN_ENV];
	return value && value.length > 0 ? value : undefined;
}

/** Shared Sentry options for browser-side SDK initialisation. */
export type CommonBrowserSentryOptions = {
	dsn: string | undefined;
	environment: string;
	sendDefaultPii: boolean;
	tracesSampleRate: number;
	profileSessionSampleRate: number;
	profileLifecycle: "trace";
	replaysSessionSampleRate: number;
	replaysOnErrorSampleRate: number;
	enableLogs: boolean;
};

export function getCommonOptions(
	env: ImportMetaEnv,
): CommonBrowserSentryOptions {
	const environment = env.MODE ?? "development";
	const isProd = environment === "production";
	return {
		dsn: readDsn(env),
		environment,
		sendDefaultPii: true,
		tracesSampleRate: isProd ? 0.1 : 1.0,
		// Decided once per `Sentry.init`, so once per page-load session, not per
		// transaction the way the deprecated `profilesSampleRate` was: half of
		// sessions are eligible, and within those `profileLifecycle: "trace"`
		// profiles only the pageload/navigation spans that tracing already
		// sampled. Do not set both this and `profilesSampleRate` — the SDK takes
		// the legacy path whenever the latter is present and ignores this one
		// entirely.
		profileSessionSampleRate: isProd ? 0.5 : 1.0,
		profileLifecycle: "trace",
		replaysSessionSampleRate: isProd ? 0.1 : 0,
		replaysOnErrorSampleRate: 1.0,
		enableLogs: true,
	};
}
