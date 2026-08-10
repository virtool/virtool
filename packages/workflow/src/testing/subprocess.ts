/**
 * A `RunSubprocess` that spawns nothing.
 *
 * It reproduces `createRunSubprocess`'s outcome table exactly, because the three
 * outcomes a naive fake collapses into one are the three a workflow step
 * branches on:
 *
 * 1. **Spawn failure** — `SubprocessSpawnError`. A missing executable is a
 *    different event from a tool that ran and failed.
 * 2. **Non-zero exit** — `SubprocessFailedError`, carrying the stderr tail. The
 *    real runner drains stderr *and* the process promise before deciding,
 *    because a subprocess can exit before its stdio is drained and the tail is
 *    what says why it failed. A fake that throws without one tests a message
 *    that is never empty in production.
 * 3. **Cancellation** — `exitCode === null` and `signal === "SIGTERM"`, resolved
 *    as `cancelled: true`. Not `exitCode === 15`: Python treats 15 as a success
 *    on the reasoning that the run was already failing, and that reasoning does
 *    not survive a tool choosing 15 as an ordinary error code.
 *
 * ## `cd-hit-est -h` exits 1
 *
 * Several steps probe a tool's version, and `cd-hit-est -h` prints its banner
 * and exits 1. **`RunSubprocessOptions` has no allowed-exit-codes escape** and
 * the runner throws on any non-zero exit, so the fake models that probe as an
 * ordinary `SubprocessFailedError` and **the call site catches it and reads
 * `stderrTail`**. The runner does not return success for it and must not be
 * taught to. If the runner ever grows an `okExitCodes` option this changes, and
 * it changes there rather than here.
 */

import {
	type RunSubprocess,
	type RunSubprocessOptions,
	STDERR_TAIL_LINES,
	SubprocessFailedError,
	type SubprocessResult,
	SubprocessSpawnError,
} from "../subprocess/types";

/** How a registered command behaves. */
export type FakeSubprocessResponse = {
	/** Lines delivered to the `stdout` handler, if the caller passed one. */
	stdout?: readonly string[];
	/** Lines delivered to the `stderr` handler and kept as the tail. */
	stderr?: readonly string[];
	/** Defaults to 0. Any other value throws `SubprocessFailedError`. */
	exitCode?: number;
	/**
	 * Fail to start, with this Node error code — `ENOENT` for a missing
	 * executable. Nothing is read and no exit code applies.
	 */
	spawnError?: string;
	/**
	 * The run was cancelled and the process group was killed.
	 *
	 * Resolves as `{ exitCode: null, signal: "SIGTERM", cancelled: true }`
	 * regardless of `exitCode`.
	 */
	cancelled?: boolean;
	/** Reported on the result. Defaults to 0. */
	durationMs?: number;
};

/** Decides whether a registration applies to a command. */
export type CommandMatcher =
	| string
	| readonly string[]
	| ((command: readonly string[]) => boolean);

/** A `RunSubprocess` with registration and assertion helpers. */
export type FakeSubprocessRunner = RunSubprocess & {
	/**
	 * Register a response. The **last** matching registration wins, so a test can
	 * override a default set up in a shared helper.
	 */
	register: (match: CommandMatcher, response: FakeSubprocessResponse) => void;

	/** Every call, with its full options. */
	calls: () => readonly RunSubprocessOptions[];

	/** Every command, with its full argv. */
	commands: () => readonly (readonly string[])[];

	/** Whether any call's argv begins with `prefix`. */
	wasRun: (prefix: readonly string[]) => boolean;
};

function toPredicate(
	match: CommandMatcher,
): (command: readonly string[]) => boolean {
	if (typeof match === "function") {
		return match;
	}

	// A bare string matches the executable; an array matches an argv prefix, so a
	// registration does not have to spell out a path the test does not care about.
	const prefix = typeof match === "string" ? [match] : match;

	return (command) =>
		prefix.every((argument, index) => command[index] === argument);
}

/**
 * Build a fake runner.
 *
 * `defaultResponse` covers any command with no registration, and defaults to a
 * silent success — a step that shells out to something the test does not care
 * about should not have to register it.
 */
export function createFakeSubprocessRunner(
	defaultResponse: FakeSubprocessResponse = {},
): FakeSubprocessRunner {
	const calls: RunSubprocessOptions[] = [];

	const registrations: {
		matches: (command: readonly string[]) => boolean;
		response: FakeSubprocessResponse;
	}[] = [];

	function resolve(command: readonly string[]): FakeSubprocessResponse {
		for (let index = registrations.length - 1; index >= 0; index -= 1) {
			const registration = registrations[index];

			if (registration?.matches(command)) {
				return registration.response;
			}
		}

		return defaultResponse;
	}

	const run = (async (options: RunSubprocessOptions) => {
		const { command, stdout, stderr } = options;

		calls.push(options);

		const response = resolve(command);

		if (response.spawnError !== undefined) {
			throw new SubprocessSpawnError(command, response.spawnError);
		}

		// Handlers are awaited before the next line, matching the backpressure the
		// real runner applies. A step whose handler throws must fail here too.
		for (const line of response.stdout ?? []) {
			await stdout?.(line);
		}

		const stderrTail: string[] = [];

		for (const line of response.stderr ?? []) {
			stderrTail.push(line);

			if (stderrTail.length > STDERR_TAIL_LINES) {
				stderrTail.shift();
			}

			await stderr?.(line);
		}

		const durationMs = response.durationMs ?? 0;

		if (response.cancelled) {
			const result: SubprocessResult = {
				command,
				exitCode: null,
				signal: "SIGTERM",
				cancelled: true,
				stderrTail,
				durationMs,
			};

			return result;
		}

		const exitCode = response.exitCode ?? 0;

		if (exitCode !== 0) {
			throw new SubprocessFailedError({
				command,
				exitCode,
				signal: null,
				stderrTail,
			});
		}

		const result: SubprocessResult = {
			command,
			exitCode,
			signal: null,
			cancelled: false,
			stderrTail,
			durationMs,
		};

		return result;
	}) as FakeSubprocessRunner;

	run.register = (match, response) => {
		registrations.push({ matches: toPredicate(match), response });
	};

	run.calls = () => calls;

	run.commands = () => calls.map((call) => call.command);

	run.wasRun = (prefix) =>
		calls.some((call) => toPredicate(prefix)(call.command));

	return run;
}
