import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createRecordingLogger } from "../testFixtures";
import { createRunSubprocess } from "./execa";
import {
	SubprocessFailedError,
	SubprocessLineLimitError,
	SubprocessSpawnError,
} from "./types";

let scriptDir: string;

beforeAll(async () => {
	scriptDir = await mkdtemp(join(tmpdir(), "workflow-subprocess-"));
});

/** Write a node script into the temp directory and return its path. */
async function script(name: string, source: string): Promise<string> {
	const path = join(scriptDir, `${name}.mjs`);

	await writeFile(path, source);

	return path;
}

/** A runner plus the log records it produced. */
function createRunner(signal?: AbortSignal) {
	const { logger, records } = createRecordingLogger();

	return {
		records,
		runSubprocess: createRunSubprocess({
			signal: signal ?? new AbortController().signal,
			logger,
			// Tests that cancel assert the tree is dead promptly; the 5s
			// production delay would make each of them a five-second test.
			forceKillAfterDelay: 200,
		}),
	};
}

function node(path: string, ...args: string[]): string[] {
	return [process.execPath, path, ...args];
}

/** Whether a pid is still alive. Signal 0 checks without delivering. */
function isAlive(pid: number): boolean {
	try {
		process.kill(pid, 0);

		return true;
	} catch {
		return false;
	}
}

async function waitForExit(pid: number, timeoutMs = 5000): Promise<boolean> {
	const deadline = Date.now() + timeoutMs;

	while (Date.now() < deadline) {
		if (!isAlive(pid)) {
			return true;
		}

		await delay(20);
	}

	return false;
}

const survivors: number[] = [];

afterAll(() => {
	for (const pid of survivors) {
		try {
			process.kill(pid, "SIGKILL");
		} catch {
			// Already gone, which is what the assertions wanted anyway.
		}
	}
});

describe("createRunSubprocess", () => {
	it("resolves when the subprocess exits zero", async () => {
		const path = await script("ok", "process.exit(0)");
		const { runSubprocess } = createRunner();

		const result = await runSubprocess({ command: node(path) });

		expect(result.exitCode).toBe(0);
		expect(result.signal).toBeNull();
		expect(result.cancelled).toBe(false);
		expect(result.durationMs).toBeGreaterThan(0);
	});

	// The subprocess exits the moment it has written, so its stderr is still
	// undrained when the process promise settles. Deciding the outcome on that
	// promise alone loses the tail that says why the run failed.
	it("keeps the last twenty stderr lines of a subprocess that exits before its stdio drains", async () => {
		const path = await script(
			"stderrTail",
			`for (let i = 1; i <= 25; i++) { process.stderr.write("line " + i + "\\n"); }
			 process.exit(1);`,
		);

		const { runSubprocess } = createRunner();

		const error = await runSubprocess({ command: node(path) }).catch(
			(err) => err,
		);

		expect(error).toBeInstanceOf(SubprocessFailedError);
		expect(error.stderrTail).toHaveLength(20);
		expect(error.stderrTail[0]).toBe("line 6");
		expect(error.stderrTail[19]).toBe("line 25");
		expect(error.message).toContain("Subprocess failed with exit code 1");
		expect(error.message).toContain("stderr:\nline 6");
	});

	it("logs every stderr line as a structured field with the newline stripped", async () => {
		const path = await script(
			"stderrLog",
			'process.stderr.write("building index\\nfinished\\n");',
		);

		const { runSubprocess, records } = createRunner();

		await runSubprocess({ command: node(path) });

		const lines = records()
			.filter((record) => record.msg === "stderr")
			.map((record) => record.line);

		expect(lines).toEqual(["building index", "finished"]);
	});

	it("passes stderr lines to a handler as well as the logger", async () => {
		const path = await script(
			"stderrHandler",
			'process.stderr.write("one\\ntwo\\n");',
		);

		const seen: string[] = [];
		const { runSubprocess } = createRunner();

		await runSubprocess({
			command: node(path),
			stderr: async (line) => {
				seen.push(line);
			},
		});

		expect(seen).toEqual(["one", "two"]);
	});

	// A tool writing a SAM stream to stdout would otherwise fill a pipe nobody
	// reads, so without a handler stdout is not piped at all.
	it("does not pipe stdout when no handler was given", async () => {
		const path = await script(
			"bigStdout",
			`import { fstatSync } from "node:fs";
			 process.stderr.write("fifo=" + fstatSync(1).isFIFO() + "\\n");
			 const chunk = Buffer.alloc(1024 * 1024, 97);
			 for (let i = 0; i < 200; i++) { process.stdout.write(chunk); }`,
		);

		const { runSubprocess } = createRunner();
		const before = process.memoryUsage().rss;

		const seen: string[] = [];

		await runSubprocess({
			command: node(path),
			stderr: (line) => {
				seen.push(line);
			},
		});

		expect(seen).toEqual(["fifo=false"]);
		expect(process.memoryUsage().rss - before).toBeLessThan(100 * 1024 * 1024);
	});

	it("delivers every stdout line in order, including a final line with no newline", async () => {
		const path = await script(
			"stdoutHandler",
			'process.stdout.write("first\\nsecond\\nthird");',
		);

		const seen: string[] = [];
		const { runSubprocess } = createRunner();

		await runSubprocess({
			command: node(path),
			stdout: (line) => {
				seen.push(line);
			},
		});

		expect(seen).toEqual(["first", "second", "third"]);
	});

	it("throws and kills the tree when a line exceeds the cap", async () => {
		const path = await script(
			"longLine",
			`process.stderr.write("x".repeat(4096));
			 setInterval(() => {}, 1000);`,
		);

		const { runSubprocess } = createRunner();

		const error = await runSubprocess({
			command: node(path),
			maxLineBytes: 1024,
		}).catch((err) => err);

		expect(error).toBeInstanceOf(SubprocessLineLimitError);
		expect(error.stream).toBe("stderr");
		expect(error.maxLineBytes).toBe(1024);
	});

	it("resolves as cancelled, with the descendants dead, when the run is cancelled", async () => {
		const child = await script(
			"descendant",
			`process.stderr.write("descendant " + process.pid + "\\n");
			 setInterval(() => {}, 1000);`,
		);

		const parent = await script(
			"parent",
			`import { spawn } from "node:child_process";
			 spawn(process.execPath, [${JSON.stringify(child)}], { stdio: ["ignore", "ignore", "inherit"] });
			 setInterval(() => {}, 1000);`,
		);

		const controller = new AbortController();
		const { runSubprocess } = createRunner(controller.signal);

		let descendantPid: number | undefined;

		const running = runSubprocess({
			command: node(parent),
			stderr: (line) => {
				const match = /^descendant (\d+)$/.exec(line);

				if (match?.[1]) {
					descendantPid = Number(match[1]);
					controller.abort();
				}
			},
		});

		const result = await running;

		expect(result.cancelled).toBe(true);
		expect(result.exitCode).toBeNull();
		expect(result.signal).toBe("SIGTERM");

		expect(descendantPid).toBeDefined();

		if (descendantPid !== undefined) {
			survivors.push(descendantPid);

			expect(await waitForExit(descendantPid)).toBe(true);
		}
	});

	// The escalation has to outlive the call. The direct child dies on SIGTERM
	// and the descendant holds none of the piped stdio, so everything the call
	// awaits settles while the descendant is still running — and it only ever
	// receives SIGKILL if the timer survives the runner returning.
	it("escalates to SIGKILL after the call returns, for a descendant that ignored SIGTERM", async () => {
		const readyPath = join(scriptDir, "stubborn-ready");

		// The descendant announces itself through a file rather than stderr,
		// because holding the inherited pipe open is the very thing that would
		// keep the call from returning early.
		const child = await script(
			"stubbornDescendant",
			`import { writeFileSync } from "node:fs";
			 process.on("SIGTERM", () => {});
			 writeFileSync(${JSON.stringify(readyPath)}, "ok");
			 setInterval(() => {}, 1000);`,
		);

		// Announcing only once the handler is installed. Node takes tens of
		// milliseconds to boot, and a SIGTERM arriving before then is the
		// default action, which would kill the descendant and prove nothing.
		const parent = await script(
			"stubbornParent",
			`import { spawn } from "node:child_process";
			 import { existsSync } from "node:fs";
			 const child = spawn(process.execPath, [${JSON.stringify(child)}], {
			 	stdio: ["ignore", "ignore", "ignore"],
			 });
			 const wait = setInterval(() => {
			 	if (existsSync(${JSON.stringify(readyPath)})) {
			 		clearInterval(wait);
			 		process.stderr.write("descendant " + child.pid + "\\n");
			 	}
			 }, 10);
			 setInterval(() => {}, 1000);`,
		);

		const controller = new AbortController();
		const { runSubprocess } = createRunner(controller.signal);

		let descendantPid: number | undefined;

		const result = await runSubprocess({
			command: node(parent),
			stderr: (line) => {
				const match = /^descendant (\d+)$/.exec(line);

				if (match?.[1]) {
					descendantPid = Number(match[1]);
					controller.abort();
				}
			},
		});

		expect(result.cancelled).toBe(true);
		expect(descendantPid).toBeDefined();

		if (descendantPid !== undefined) {
			survivors.push(descendantPid);

			// Still alive when the call returned: it ignored the SIGTERM.
			expect(isAlive(descendantPid)).toBe(true);
			expect(await waitForExit(descendantPid, 2000)).toBe(true);
		}
	});

	// Python treats 15 as a success, on the reasoning that the run was already
	// failing. A tool is free to use 15 as an ordinary error code.
	it("fails on exit code 15 when nothing cancelled the run", async () => {
		const path = await script("fifteen", "process.exit(15)");
		const { runSubprocess } = createRunner();

		const error = await runSubprocess({ command: node(path) }).catch(
			(err) => err,
		);

		expect(error).toBeInstanceOf(SubprocessFailedError);
		expect(error.exitCode).toBe(15);
	});

	it("throws a spawn error when the executable is missing", async () => {
		const { runSubprocess } = createRunner();

		const error = await runSubprocess({
			command: [join(scriptDir, "does-not-exist")],
		}).catch((err) => err);

		expect(error).toBeInstanceOf(SubprocessSpawnError);
		expect(error.code).toBe("ENOENT");
	});

	// The kill lands after the subprocess is already gone, so `process.kill`
	// raises ESRCH. That is the ordinary outcome of a cancellation racing an
	// exit and must not reach the caller.
	it("does not surface ESRCH from a kill that lands after the subprocess exited", async () => {
		const path = await script(
			"exitsFirst",
			'process.stdout.write("done\\n"); process.exit(0);',
		);

		const controller = new AbortController();
		const { runSubprocess, records } = createRunner(controller.signal);

		const result = await runSubprocess({
			command: node(path),
			stdout: async () => {
				await delay(100);
				controller.abort();
			},
		});

		expect(result.exitCode).toBe(0);
		expect(result.cancelled).toBe(false);
		expect(
			records().filter(
				(record) => typeof record.level === "number" && record.level >= 50,
			),
		).toEqual([]);
	});

	it("merges env rather than replacing it", async () => {
		const path = await script(
			"env",
			'process.stderr.write("FOO=" + process.env.FOO + " PATH=" + (process.env.PATH ? "set" : "unset") + "\\n");',
		);

		const seen: string[] = [];
		const { runSubprocess } = createRunner();

		await runSubprocess({
			command: node(path),
			env: { FOO: "bar" },
			stderr: (line) => {
				seen.push(line);
			},
		});

		expect(seen).toEqual(["FOO=bar PATH=set"]);
	});

	it("runs in the given working directory", async () => {
		const path = await script(
			"cwd",
			'process.stderr.write(process.cwd() + "\\n");',
		);

		const seen: string[] = [];
		const { runSubprocess } = createRunner();

		await runSubprocess({
			command: node(path),
			cwd: scriptDir,
			stderr: (line) => {
				seen.push(line);
			},
		});

		expect(seen[0]).toContain("workflow-subprocess-");
	});
});
