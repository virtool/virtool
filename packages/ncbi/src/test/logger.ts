import type { Logger } from "@virtool/logger";

/**
 * A logger that discards everything, for tests that exercise a path which logs
 * but are not asserting on what it logged.
 */
export const logger = {
	debug: () => undefined,
	error: () => undefined,
	info: () => undefined,
	warn: () => undefined,
} as unknown as Logger;
