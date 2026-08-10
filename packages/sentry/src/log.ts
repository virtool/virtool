type SentryLogMethod = "trace" | "debug" | "info" | "warn" | "error" | "fatal";

/**
 * The slice of a Sentry SDK's structured-logging API this stream calls.
 *
 * Declared structurally and taken as an argument rather than imported, because
 * each service initialises a different SDK — `@sentry/tanstackstart-react` in
 * `apps/web`, `@sentry/node` in `apps/jobs-api` and `apps/tasks` — and only the
 * one a process actually called `init` on will send anything. Importing one
 * here would either forward every service's records through an uninitialised
 * client or drag a second SDK into every bundle.
 */
export type SentryLogApi = {
	[Method in SentryLogMethod]: (
		message: string,
		attributes?: Record<string, unknown>,
	) => void;
};

// pino serialises levels as numbers; map them onto Sentry's logging methods.
const LEVEL_METHODS: Record<number, SentryLogMethod> = {
	10: "trace",
	20: "debug",
	30: "info",
	40: "warn",
	50: "error",
	60: "fatal",
};

const ENVELOPE_FIELDS = new Set([
	"level",
	"time",
	"pid",
	"hostname",
	"name",
	"msg",
]);

/**
 * A pino destination that forwards each record to Sentry's structured logging
 * API. pino applies redaction before any destination sees the record, so the
 * secret-bearing fields in `DEFAULT_REDACT_PATHS` arrive here already censored.
 * The standard pino envelope fields are dropped; everything else rides along as
 * Sentry log attributes.
 */
export function createSentryLogStream(sentry: SentryLogApi): {
	write(line: string): void;
} {
	return {
		write(line) {
			let record: Record<string, unknown>;
			try {
				record = JSON.parse(line);
			} catch {
				return;
			}

			const method = LEVEL_METHODS[record.level as number] ?? "info";
			const message = typeof record.msg === "string" ? record.msg : "";

			const attributes: Record<string, unknown> = {};
			for (const [key, value] of Object.entries(record)) {
				if (!ENVELOPE_FIELDS.has(key)) {
					attributes[key] = value;
				}
			}

			sentry[method](message, attributes);
		},
	};
}
