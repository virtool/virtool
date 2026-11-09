import { createIsomorphicFn } from "@tanstack/react-start";

/**
 * Name of the `<meta>` tag that carries the runtime Sentry DSN to the browser.
 */
export const SENTRY_DSN_META_NAME = "vt-sentry-dsn";

/** Read the DSN back from the `<meta>` tag in the document head. */
export function readDsnFromMeta(): string {
	return (
		document
			.querySelector(`meta[name="${SENTRY_DSN_META_NAME}"]`)
			?.getAttribute("content") ?? ""
	);
}

// `@server/config` reads `process.env` and `node:fs` when it loads, so a dynamic
// import keeps it out of the browser graph.
async function readDsnFromConfig(): Promise<string> {
	const { config } = await import("@server/config");
	return config.sentryDsn ?? "";
}

/**
 * The runtime Sentry DSN. On the server it comes from the parsed configuration;
 * on the client it is read back from the `<meta>` tag the server rendered into
 * the document head. Reading it this way — rather than from a build-time
 * `import.meta.env.VT_SENTRY_DSN` inline — keeps the DSN out of the client
 * bundle, so a single image picks up whatever DSN the runtime configuration
 * provides, and yields an identical value on server and client (no hydration
 * mismatch).
 */
export const readSentryDsn = createIsomorphicFn()
	.server(readDsnFromConfig)
	.client(readDsnFromMeta);
