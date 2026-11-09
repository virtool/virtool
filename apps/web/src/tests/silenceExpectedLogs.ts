import { onTestFinished, vi } from "vitest";

/**
 * Silence `console.error` and `console.warn` for the current test.
 *
 * Call this only in a test that exercises an error path, where a library logs
 * the failure on purpose.
 */
export function silenceExpectedLogs() {
	const error = vi.spyOn(console, "error").mockImplementation(() => {});
	const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

	onTestFinished(() => {
		error.mockRestore();
		warn.mockRestore();
	});
}
