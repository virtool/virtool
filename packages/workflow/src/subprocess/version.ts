import { WorkflowError } from "../errors";

/**
 * Pull a tool's version out of the lines it printed.
 *
 * Every tool announces itself differently — some on stdout and exiting 0, some
 * in a help banner on stderr after exiting 1 — so the caller runs the process
 * and collects the lines; this only reads them.
 *
 * @throws {WorkflowError} when no line matches, which is also what a missing
 *   binary looks like by the time its output is empty.
 */
export function matchToolVersion(
	pattern: RegExp,
	lines: readonly string[],
	message: string,
): string {
	// Joined with a newline, not the empty string. Python concatenates lines that
	// still carry their terminator, so `"".join(...)` reproduces the original
	// text; the runtime's line handler has already stripped it, and joining with
	// nothing would run the last word of one line into the first of the next.
	const match = pattern.exec(lines.join("\n"));

	const version = match?.[1];

	if (version === undefined) {
		throw new WorkflowError(message);
	}

	return version;
}
