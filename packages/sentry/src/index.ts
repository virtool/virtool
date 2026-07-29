export const SENTRY_DSN_ENV = "VT_SENTRY_DSN";

export function readDsn(): string | undefined {
	const value = process.env[SENTRY_DSN_ENV];
	return value && value.length > 0 ? value : undefined;
}

/** Shared Sentry options for server-side SDK initialisation. */
export type CommonSentryOptions = {
	dsn: string | undefined;
	environment: string;
	sendDefaultPii: boolean;
	tracesSampleRate: number;
	profileSessionSampleRate: number;
	profileLifecycle: "trace";
	enableLogs: boolean;
};

export function getCommonOptions(): CommonSentryOptions {
	const environment = process.env.NODE_ENV ?? "development";
	const isProd = environment === "production";
	return {
		dsn: readDsn(),
		environment,
		sendDefaultPii: true,
		tracesSampleRate: isProd ? 0.1 : 1.0,
		// Decided once per `Sentry.init` — that is, once per server process, not
		// per transaction the way the deprecated `profilesSampleRate` was. Half
		// the replicas therefore profile and half do not, which is what bounds
		// the cost: `profileLifecycle: "trace"` runs the profiler for as long as
		// any sampled root span is in flight, and on a busy server that is close
		// to continuously. Do not set both this and `profilesSampleRate` — the
		// SDK takes the legacy path whenever the latter is present and ignores
		// this one entirely.
		profileSessionSampleRate: isProd ? 0.5 : 1.0,
		profileLifecycle: "trace",
		enableLogs: true,
	};
}
