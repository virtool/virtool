export const SENTRY_DSN_ENV = "VT_SENTRY_DSN";

export function readDsn(): string | undefined {
	const value = process.env[SENTRY_DSN_ENV];
	return value && value.length > 0 ? value : undefined;
}

/** Request paths whose traces are dropped outright. */
const UNSAMPLED_PATHS = new Set(["/health/live", "/health/ready"]);

/** Request paths sampled at `COUNTS_SAMPLE_RATE` rather than the usual one. */
const COUNTS_PATHS = new Set(["/jobs/counts"]);

const COUNTS_SAMPLE_RATE = 0.01;

/**
 * The slice of Sentry's sampling context the sampler below reads.
 *
 * Declared structurally and never imported, for the same reason `SentryLogApi`
 * is: this package depends on no SDK, and the three services initialise two
 * different ones.
 */
export type SentrySamplingContext = {
	attributes?: Record<string, unknown>;
	inheritOrSampleWith: (fallbackSampleRate: number) => number;
};

/**
 * Decide a root span's sample rate by request path.
 *
 * `url.path` is the query-stripped pathname the SDK attaches when it opens an
 * incoming server span. `http.route` is deliberately not read: the framework
 * only knows the matched route once the response is going out, and by then the
 * sampling decision is long made. Nothing unbounded follows from that — every
 * path compared here is a literal, so the decision has three outcomes however
 * many distinct URLs arrive.
 *
 * A span with no path — an outgoing request, a workflow's manually-started
 * span — falls through to the default rate untouched.
 */
function createTracesSampler(
	defaultSampleRate: number,
): (context: SentrySamplingContext) => number {
	return function tracesSampler(context) {
		const path = context.attributes?.["url.path"];

		if (typeof path === "string") {
			if (UNSAMPLED_PATHS.has(path)) {
				return 0;
			}

			if (COUNTS_PATHS.has(path)) {
				return COUNTS_SAMPLE_RATE;
			}
		}

		/*
		 * A sampler overrides the parent's decision as well as the flat rate, so
		 * everything not named above has to inherit explicitly to keep a
		 * distributed trace whole — which is what `tracesSampleRate` alone used
		 * to do on its own.
		 */
		return context.inheritOrSampleWith(defaultSampleRate);
	};
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
	/**
	 * Decides each root span's rate, in place of a flat `tracesSampleRate`.
	 *
	 * The two must never both be set: the SDK takes the sampler and ignores the
	 * rate entirely, so a `tracesSampleRate` beside this one is a figure nothing
	 * reads. The default rate lives inside the sampler instead.
	 */
	tracesSampler: (context: SentrySamplingContext) => number;
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
		tracesSampler: createTracesSampler(isProd ? 0.1 : 1.0),
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
