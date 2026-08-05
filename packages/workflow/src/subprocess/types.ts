import { WorkflowError } from "../errors";

/**
 * Handles one line of a subprocess' output.
 *
 * The trailing newline is already stripped. An async handler is awaited before
 * the next line is read, so a slow handler applies backpressure to the
 * subprocess rather than queueing its output in this process.
 */
export type LineHandler = (line: string) => void | Promise<void>;

/** Everything a caller says about one subprocess. */
export type RunSubprocessOptions = {
	/** The executable and its arguments. Never a shell string. */
	command: readonly string[];
	/** Working directory. Defaults to this process'. */
	cwd?: string;
	/** Extra environment variables, **merged** into this process' own. */
	env?: Record<string, string>;
	/**
	 * Called for each line of stdout.
	 *
	 * Without one, stdout is not piped at all: a tool that writes a SAM stream
	 * to stdout would otherwise fill this process' heap with output nobody
	 * reads.
	 */
	stdout?: LineHandler;
	/** Called for each line of stderr, after it is logged. */
	stderr?: LineHandler;
	/**
	 * Largest line either stream may produce, in bytes. Defaults to
	 * {@link DEFAULT_MAX_LINE_BYTES}.
	 */
	maxLineBytes?: number;
};

/** How a subprocess ended. */
export type SubprocessResult = {
	command: readonly string[];
	/** `null` when a signal terminated the subprocess. */
	exitCode: number | null;
	/** The signal that terminated the subprocess, if one did. */
	signal: string | null;
	/** The run was cancelled and this subprocess was killed because of it. */
	cancelled: boolean;
	/** The last {@link STDERR_TAIL_LINES} lines of stderr, in order. */
	stderrTail: readonly string[];
	durationMs: number;
};

/**
 * Runs one subprocess to completion.
 *
 * A plain function rather than a class, so a test hands a workflow step a
 * `vi.fn()` and asserts on the commands it was asked to run.
 *
 * @throws {SubprocessSpawnError} when the executable could not be started.
 * @throws {SubprocessFailedError} when it exited non-zero for any reason other
 *   than the run being cancelled.
 * @throws {SubprocessLineLimitError} when either stream produced a line longer
 *   than `maxLineBytes`.
 */
export type RunSubprocess = (
	options: RunSubprocessOptions,
) => Promise<SubprocessResult>;

/**
 * The line cap, matching the `limit` Python passes to
 * `asyncio.create_subprocess_exec`.
 *
 * It is not a memory budget so much as a guard against a tool that writes an
 * unbounded stream with no newline in it — without a ceiling the reader
 * accumulates the whole thing before ever calling a handler.
 */
export const DEFAULT_MAX_LINE_BYTES = 128 * 1024 * 1024;

/** How many trailing stderr lines a failure carries. */
export const STDERR_TAIL_LINES = 20;

/** A subprocess exited non-zero. */
export class SubprocessFailedError extends WorkflowError {
	readonly command: readonly string[];
	readonly exitCode: number | null;
	readonly signal: string | null;
	readonly stderrTail: readonly string[];

	constructor(result: Omit<SubprocessResult, "cancelled" | "durationMs">) {
		super(formatFailure(result));

		this.command = result.command;
		this.exitCode = result.exitCode;
		this.signal = result.signal;
		this.stderrTail = result.stderrTail;
	}
}

function formatFailure({
	command,
	exitCode,
	signal,
	stderrTail,
}: Omit<SubprocessResult, "cancelled" | "durationMs">): string {
	const cause =
		exitCode === null ? `signal ${signal}` : `exit code ${exitCode}`;

	const message = `Subprocess failed with ${cause}: ${command.join(" ")}`;

	return stderrTail.length === 0
		? message
		: `${message}\nstderr:\n${stderrTail.join("\n")}`;
}

/** A subprocess could not be started at all. */
export class SubprocessSpawnError extends WorkflowError {
	readonly command: readonly string[];
	/** The Node error code, such as `ENOENT` or `EACCES`. */
	readonly code: string | null;

	constructor(
		command: readonly string[],
		code: string | null,
		options?: ErrorOptions,
	) {
		super(
			`Subprocess could not be started${code === null ? "" : ` (${code})`}: ${command.join(" ")}`,
			options,
		);

		this.command = command;
		this.code = code;
	}
}

/** A subprocess produced a line longer than the cap. */
export class SubprocessLineLimitError extends WorkflowError {
	readonly command: readonly string[];
	readonly stream: "stdout" | "stderr";
	readonly maxLineBytes: number;

	constructor(
		command: readonly string[],
		stream: "stdout" | "stderr",
		maxLineBytes: number,
	) {
		super(
			`Subprocess produced a ${stream} line longer than ${maxLineBytes} bytes: ${command.join(" ")}`,
		);

		this.command = command;
		this.stream = stream;
		this.maxLineBytes = maxLineBytes;
	}
}
