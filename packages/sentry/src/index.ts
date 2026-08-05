export const SENTRY_DSN_ENV = "VT_SENTRY_DSN";

export function readDsn(): string | undefined {
	const value = process.env[SENTRY_DSN_ENV];
	return value && value.length > 0 ? value : undefined;
}

/** Shared Sentry options for server-side SDK initialisation. */
export type CommonSentryOptions = {
	dsn: string | undefined;
	environment: string;
	/**
	 * Distinguishes one service's build artifacts from another's.
	 *
	 * Every image in this repo shares the release version, so without a `dist`
	 * the web app's and the jobs API's source maps collide under one release and
	 * a stack trace resolves against whichever uploaded last.
	 */
	dist: string;
	/**
	 * Tags every event with the service that reported it.
	 *
	 * Both services report to the same Sentry project, which is what makes one
	 * search across the whole backend possible. The tag is what lets an issue
	 * list, an alert rule, or a dashboard narrow back down to one of them.
	 */
	initialScope: { tags: { service: string } };
	sendDefaultPii: boolean;
	tracesSampleRate: number;
	profileSessionSampleRate: number;
	profileLifecycle: "trace";
	enableLogs: boolean;
};

/**
 * Build the Sentry options every server-side process shares.
 *
 * `service` names the process — `"web"`, `"jobs-api"` — and is required rather
 * than defaulted, because an untagged event is indistinguishable from one whose
 * tagging silently regressed.
 */
export function getCommonOptions(service: string): CommonSentryOptions {
	const environment = process.env.NODE_ENV ?? "development";
	const isProd = environment === "production";
	return {
		dsn: readDsn(),
		environment,
		dist: service,
		initialScope: { tags: { service } },
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
