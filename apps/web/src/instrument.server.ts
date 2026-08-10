import * as Sentry from "@sentry/tanstackstart-react";
import { dropExpectedClientErrors } from "@server/sentryFilters";
import { getCommonOptions } from "@virtool/sentry";

// Server-side Sentry initialisation. Imported for its side effect at the top of
// `server.ts` so the SDK is ready before any request is handled. `enableLogs`
// (set in `getCommonOptions`) is what lets `@virtool/logger` forward records via
// `Sentry.logger`. No DSN means no init, so dev and unconfigured deploys are
// untouched.
const options = getCommonOptions("web");

// The DSN comes from `config`, not from `options.dsn`. `getCommonOptions` reads
// it with `readDsn`, which goes straight to `process.env` and so cannot see a
// `VT_SENTRY_DSN_FILE` mount — a deployment following the `<KEY>_FILE`
// convention would have had Sentry silently disabled. Imported dynamically for
// the same reason `@server/logger` is below: a top-level import front-loads the
// module graph before the SDK installs its hooks.
//
// The browser DSN is a separate value, baked in at build time by Vite from
// `import.meta.env`, and cannot be file-backed at all.
const { config } = await import("@server/config");
const dsn = config.sentryDsn;

if (dsn) {
	// Import the profiler lazily and only when configured. `@sentry/profiling-node`
	// pulls in a native CommonJS addon that the Vite/Nitro SSR transform can't
	// process, so a top-level import breaks dev and tests where no DSN is set.
	// Mirrors the DSN-gated `await import` used for the pino→Sentry stream.
	const { nodeProfilingIntegration } = await import("@sentry/profiling-node");
	Sentry.init({
		...options,
		dsn,
		integrations: [nodeProfilingIntegration()],
		beforeSend: dropExpectedClientErrors,
	});

	// Import the logger lazily and only after `Sentry.init`. `@server/logger`
	// transitively pulls in the Sentry SDK graph — it hands the SDK's `logger`
	// to `createSentryLogStream` — so a top-level import would front-load it
	// before Sentry's Node auto-instrumentation has a chance to install its
	// import hooks.
	const { logger } = await import("@server/logger");
	logger.info(
		{ environment: options.environment, foundSentryDsn: true },
		"sentry initialised",
	);
} else {
	const { logger } = await import("@server/logger");
	logger.info(
		{ environment: options.environment, foundSentryDsn: false },
		"sentry disabled",
	);
}
