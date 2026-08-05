import type { Readable } from "node:stream";
import type { Logger } from "@virtool/logger";
import { execa } from "execa";
import { WorkflowError } from "../errors";
import { createLineSplitter } from "./lines";
import {
	DEFAULT_MAX_LINE_BYTES,
	type LineHandler,
	type RunSubprocess,
	STDERR_TAIL_LINES,
	SubprocessFailedError,
	SubprocessLineLimitError,
	SubprocessSpawnError,
} from "./types";

/** Options for {@link createRunSubprocess}. */
export type CreateRunSubprocessOptions = {
	/**
	 * The run's signal. Aborting it kills the process **group** of every
	 * subprocess this runner still has open.
	 */
	signal: AbortSignal;
	logger: Logger;
	/** Milliseconds between the group's SIGTERM and its SIGKILL. */
	forceKillAfterDelay?: number;
};

const DEFAULT_FORCE_KILL_AFTER_DELAY = 5000;

/**
 * Build the subprocess runner a run's steps share.
 *
 * The signal and the logger are bound once here rather than passed per call,
 * so a step cannot forget to forward cancellation to a forty-minute alignment.
 */
export function createRunSubprocess({
	signal,
	logger,
	forceKillAfterDelay = DEFAULT_FORCE_KILL_AFTER_DELAY,
}: CreateRunSubprocessOptions): RunSubprocess {
	return async function runSubprocess({
		command,
		cwd,
		env,
		stdout,
		stderr,
		maxLineBytes = DEFAULT_MAX_LINE_BYTES,
	}) {
		const [file, ...args] = command;

		if (file === undefined) {
			throw new WorkflowError("refusing to run an empty command");
		}

		logger.info({ command }, "running subprocess");

		const subprocess = execa(file, args, {
			cwd,
			env,
			// Merged, not replaced. A tool that loses PATH cannot find the
			// interpreter its own wrapper script is written in.
			extendEnv: true,
			// A command is an array of arguments and is never re-parsed.
			shell: false,
			// `setsid`, so the child leads a process group of its own and a
			// signal sent to `-pid` reaches every descendant. Nothing in execa
			// does this: `kill()` and `cancelSignal` signal the direct child
			// only, which for bowtie2 and bowtie2-build is a perl script whose
			// real binary would go on running.
			detached: true,
			// Streamed and never accumulated, so this process' memory does not
			// grow with a tool's output.
			buffer: false,
			// Nothing here reads stdin, and a detached subprocess has no
			// controlling terminal to read one from without taking SIGTTIN.
			stdin: "ignore",
			// Not piped at all without a handler: an unread pipe is a buffer
			// that fills, and a tool writing a SAM stream to stdout would fill
			// it fast.
			stdout: stdout ? "pipe" : "ignore",
			stderr: "pipe",
			// Every outcome is mapped below, and a rejection here would carry
			// none of the stderr tail.
			reject: false,
		});

		const { pid } = subprocess;

		if (pid !== undefined) {
			logger.info({ pid, command }, "started subprocess");
		}

		/**
		 * Signal the whole process group.
		 *
		 * ESRCH means the group is already gone, which is the ordinary outcome
		 * of a kill racing a subprocess that was exiting anyway; EPIPE is the
		 * same race seen from the other end. Neither is worth surfacing.
		 */
		function killGroup(killSignal: NodeJS.Signals): void {
			if (pid === undefined) {
				return;
			}

			try {
				process.kill(-pid, killSignal);
			} catch (err) {
				logger.debug(
					{ err, pid, signal: killSignal },
					"could not signal subprocess group",
				);
			}
		}

		let killSent = false;
		let forceKillTimer: NodeJS.Timeout | undefined;

		function terminate(): void {
			if (killSent) {
				return;
			}

			killSent = true;

			killGroup("SIGTERM");

			forceKillTimer = setTimeout(() => {
				killGroup("SIGKILL");

				// Nothing can ignore SIGKILL, so the group is gone and the
				// exit fallback has nothing left to cover.
				process.off("exit", killOnExit);
			}, forceKillAfterDelay);

			// The timer must never be the reason this process stays alive.
			forceKillTimer.unref();
		}

		// `detached` turns off execa's own cleanup-on-exit, so this stands in
		// for it. Without it a crash in the parent strands a running aligner.
		function killOnExit(): void {
			killGroup("SIGKILL");
		}

		process.once("exit", killOnExit);
		signal.addEventListener("abort", terminate, { once: true });

		if (signal.aborted) {
			terminate();
		}

		const stderrTail: string[] = [];

		let readerError: unknown;

		/**
		 * Drain one stream, giving up on the whole subprocess if it overruns
		 * the line cap.
		 *
		 * The overrun has to kill the tree: this is the only reader, so a
		 * subprocess whose output stops being consumed blocks forever on its
		 * next write instead of failing.
		 */
		async function read(
			stream: Readable,
			name: "stdout" | "stderr",
			onLine: LineHandler,
		): Promise<void> {
			const splitter = createLineSplitter({
				onLine,
				maxLineBytes,
				createLimitError: () =>
					new SubprocessLineLimitError(command, name, maxLineBytes),
			});

			try {
				for await (const chunk of stream) {
					await splitter.push(chunk as Buffer);
				}

				await splitter.flush();
			} catch (err) {
				readerError ??= err;

				stream.destroy();
				killGroup("SIGKILL");
			}
		}

		const readers = [
			read(subprocess.stderr as Readable, "stderr", async (line) => {
				logger.info({ line }, "stderr");

				stderrTail.push(line);

				if (stderrTail.length > STDERR_TAIL_LINES) {
					stderrTail.shift();
				}

				await stderr?.(line);
			}),
		];

		if (stdout) {
			readers.push(read(subprocess.stdout as Readable, "stdout", stdout));
		}

		// Both halves, always. A subprocess can exit before its stdio has been
		// drained, and deciding the outcome on the process promise alone loses
		// the tail of stderr that says why it failed.
		//
		// The `finally` is what keeps a long run's listener count flat: a
		// workflow runs hundreds of these, and one leaked `exit` listener per
		// failure trips Node's max-listeners warning long before the run ends.
		let result: Awaited<typeof subprocess>;

		try {
			[result] = await Promise.all([subprocess, ...readers]);
		} finally {
			signal.removeEventListener("abort", terminate);

			// The escalation deliberately outlives this call once a kill has
			// gone out. Everything awaited above can settle while the group is
			// still alive: the direct child dies on SIGTERM, and a descendant
			// that ignores it and holds none of the piped stdio leaves nothing
			// to wait on. Tearing the timer down here is what would strand it.
			if (!killSent) {
				clearTimeout(forceKillTimer);
				process.off("exit", killOnExit);
			}
		}

		const exitCode = result.exitCode ?? null;
		const terminatedBy = result.signal ?? null;

		// Neither an exit code nor a signal means it never ran.
		if (exitCode === null && terminatedBy === null) {
			throw new SubprocessSpawnError(command, result.code ?? null, {
				cause: result,
			});
		}

		if (readerError !== undefined) {
			throw readerError;
		}

		logger.info(
			{ exitCode, signal: terminatedBy, durationMs: result.durationMs },
			"subprocess finished",
		);

		const cancelled =
			signal.aborted &&
			killSent &&
			(terminatedBy === "SIGTERM" || terminatedBy === "SIGKILL");

		if (!cancelled && exitCode !== 0) {
			// Python treats 15 and -15 as a success, on the reasoning that the
			// run was already failing for another reason. That reasoning does
			// not survive a tool choosing 15 as an ordinary error code, and the
			// cancellation case above is what it was really reaching for.
			throw new SubprocessFailedError({
				command,
				exitCode,
				signal: terminatedBy,
				stderrTail,
			});
		}

		return {
			command,
			exitCode,
			signal: terminatedBy,
			cancelled,
			stderrTail,
			durationMs: result.durationMs,
		};
	};
}
