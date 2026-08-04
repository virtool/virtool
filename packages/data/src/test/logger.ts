import { createLogger, type Logger } from "@virtool/logger";

/**
 * The logger to pass to a data function under test.
 *
 * Silent, because a suite that deliberately drives a warning path — a delete of
 * a row with nothing in storage, an unreachable NCBI — would otherwise print the
 * record it provoked and read as a failure.
 */
export const testLogger: Logger = createLogger({
	name: "test",
	level: "silent",
});
