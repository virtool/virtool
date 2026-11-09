import { onTestFinished, vi } from "vitest";
import { logger } from "../logger";

/**
 * Silence the server logger and `console` for the current test.
 *
 * Call this only in a test whose subject logs on purpose. Better Auth writes to
 * `console`; everything else goes through the logger.
 */
export function silenceLogs() {
	const { level } = logger;
	logger.level = "silent";
	const error = vi.spyOn(console, "error").mockImplementation(() => {});
	const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

	onTestFinished(() => {
		logger.level = level;
		error.mockRestore();
		warn.mockRestore();
	});
}
