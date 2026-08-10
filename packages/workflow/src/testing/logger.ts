import { createLogger, type Logger } from "@virtool/logger";

/**
 * A logger that keeps its records instead of writing them.
 *
 * The only way to assert on the warnings the run loop and the ping loop emit —
 * both log and continue rather than throwing, so the record is the whole
 * observable effect.
 */
export type RecordingLogger = {
	logger: Logger;
	records: () => Array<Record<string, unknown>>;
};

export function createRecordingLogger(): RecordingLogger {
	const chunks: string[] = [];

	const logger = createLogger({
		name: "workflow-test",
		level: "debug",
		destination: {
			write(chunk: string) {
				chunks.push(chunk);
			},
		},
	});

	return {
		logger,
		records: () =>
			chunks
				.join("")
				.split("\n")
				.filter(Boolean)
				.map((line) => JSON.parse(line) as Record<string, unknown>),
	};
}
