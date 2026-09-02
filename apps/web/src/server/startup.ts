import { createLogger } from "@virtool/logger";
import { z } from "zod";
import { parseServerConfig } from "./configSchema";

/**
 * Validate the environment before the server accepts connections.
 *
 * Registered as a Nitro runtime plugin in `vite.config.js`. Nitro runs its
 * plugins once, as it constructs the app, which the Node preset does before it
 * binds the port — so a misconfigured deployment exits here instead of starting
 * and answering every request, health probes included, with a 500.
 *
 * The parse cannot live in the server entry: `server.ts` is bundled into an SSR
 * chunk that Nitro loads lazily on the first request. This file is bundled into
 * the Nitro entry instead.
 *
 * It reads `configSchema` rather than `config` because `config` parses as it
 * loads, which makes the failure a module-evaluation throw that this function
 * never sees.
 */
export default function validateServerConfiguration(): void {
	try {
		parseServerConfig();
	} catch (error) {
		// Built here rather than imported from `./logger`, which reaches for the
		// Sentry SDK when a DSN is set. This runs in the Nitro entry, a separate
		// bundle from the SSR chunk that calls `Sentry.init`, so importing it
		// would load a second copy of that graph into the process ahead of the
		// one initialisation that configures it.
		const logger = createLogger({ name: "web" });

		// Only key names and reasons. Zod's messages carry the expected type or
		// option, never the received value, and every secret Virtool takes —
		// `VT_ENCRYPTION_KEY`, the storage credentials — passes through here.
		if (error instanceof z.ZodError) {
			logger.fatal(
				{
					issues: error.issues.map((issue) => ({
						key: issue.path.join("."),
						reason: issue.message,
					})),
				},
				"invalid server configuration",
			);
		} else {
			logger.fatal(
				{ reason: error instanceof Error ? error.message : String(error) },
				"could not read server configuration",
			);
		}

		process.exit(1);
	}
}
