import { createLogger, type Logger } from "@virtool/logger";
import { readDsn } from "@virtool/sentry";
import { createSentryLogStream } from "@virtool/sentry/log";

// Only pull in the Sentry SDK when a DSN is configured. Without one (the Vite
// dev container, tests) the logger is stdout-only and the heavy `@sentry/node`
// graph — and its import-in-the-middle hooks — are never loaded. The stream
// itself carries no SDK, so only the `logger` it forwards to is imported late.
const streams = readDsn()
	? [
			{
				level: "info" as const,
				stream: createSentryLogStream(
					(await import("@sentry/tanstackstart-react")).logger,
				),
			},
		]
	: undefined;

export const logger: Logger = createLogger({ name: "web", streams });
