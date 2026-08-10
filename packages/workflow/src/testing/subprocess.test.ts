import { describe, expect, it } from "vitest";
import {
	SubprocessFailedError,
	SubprocessSpawnError,
} from "../subprocess/types";
import { createFakeSubprocessRunner } from "./subprocess";

describe("the three outcomes the real runner distinguishes", () => {
	it("fails to spawn, which is not a run failure", async () => {
		const run = createFakeSubprocessRunner();

		run.register("bowtie2", { spawnError: "ENOENT" });

		const error = await run({ command: ["bowtie2", "-x", "index"] }).catch(
			(err: unknown) => err,
		);

		expect(error).toBeInstanceOf(SubprocessSpawnError);
		expect((error as SubprocessSpawnError).code).toBe("ENOENT");
	});

	it("exits non-zero with the stderr tail intact", async () => {
		const run = createFakeSubprocessRunner();

		run.register("samtools", {
			exitCode: 1,
			stderr: ["samtools: could not open file", "aborting"],
		});

		const error = await run({ command: ["samtools", "view", "x.bam"] }).catch(
			(err: unknown) => err,
		);

		expect(error).toBeInstanceOf(SubprocessFailedError);
		expect((error as SubprocessFailedError).stderrTail).toEqual([
			"samtools: could not open file",
			"aborting",
		]);
		expect((error as SubprocessFailedError).exitCode).toBe(1);
	});

	// `code === null && signal === "SIGTERM"`, not `code === 15`. Python treats 15
	// as a success on the reasoning that the run was already failing, and that
	// reasoning does not survive a tool choosing 15 as an ordinary error code.
	it("resolves a cancellation rather than throwing", async () => {
		const run = createFakeSubprocessRunner();

		run.register("spades.py", { cancelled: true });

		const result = await run({ command: ["spades.py", "-o", "out"] });

		expect(result).toMatchObject({
			exitCode: null,
			signal: "SIGTERM",
			cancelled: true,
		});
	});

	it("keeps only the last twenty stderr lines", async () => {
		const run = createFakeSubprocessRunner();

		run.register("noisy", {
			exitCode: 1,
			stderr: Array.from({ length: 30 }, (_, index) => `line ${index}`),
		});

		const error = await run({ command: ["noisy"] }).catch(
			(err: unknown) => err as SubprocessFailedError,
		);

		expect(error.stderrTail).toHaveLength(20);
		expect(error.stderrTail[0]).toBe("line 10");
		expect(error.stderrTail.at(-1)).toBe("line 29");
	});
});

describe("version probes", () => {
	// `RunSubprocessOptions` has no allowed-exit-codes escape and the runner
	// throws on any non-zero exit, so `cd-hit-est -h` — which prints its banner
	// and exits 1 — is modelled as an ordinary failure and the probe recovers the
	// banner from `stderrTail`. If the runner ever grows an `okExitCodes` option
	// this changes, and it changes there rather than here.
	it("recovers cd-hit-est's banner from a non-zero exit", async () => {
		const run = createFakeSubprocessRunner();

		run.register(["cd-hit-est", "-h"], {
			exitCode: 1,
			stderr: ["CD-HIT version 4.8.1 (built on Jan 1 2024)", ""],
		});

		async function probeVersion(): Promise<string> {
			try {
				await run({ command: ["cd-hit-est", "-h"] });
			} catch (err) {
				if (err instanceof SubprocessFailedError) {
					return err.stderrTail[0] ?? "";
				}

				throw err;
			}

			throw new Error("cd-hit-est -h unexpectedly succeeded");
		}

		await expect(probeVersion()).resolves.toBe(
			"CD-HIT version 4.8.1 (built on Jan 1 2024)",
		);
	});

	it("delivers stdout lines to the handler a probe passes", async () => {
		const run = createFakeSubprocessRunner();
		const lines: string[] = [];

		run.register("bowtie2-build", {
			stdout: ["bowtie2-build version 2.3.2", "64-bit"],
		});

		await run({
			command: ["bowtie2-build", "--version"],
			stdout: (line) => {
				lines.push(line);
			},
		});

		expect(lines).toEqual(["bowtie2-build version 2.3.2", "64-bit"]);
	});
});

describe("registration and recording", () => {
	it("succeeds silently for a command with no registration", async () => {
		const run = createFakeSubprocessRunner();

		await expect(run({ command: ["anything"] })).resolves.toMatchObject({
			exitCode: 0,
			cancelled: false,
		});
	});

	it("lets a later registration override an earlier one", async () => {
		const run = createFakeSubprocessRunner();

		run.register("skewer", { exitCode: 1 });
		run.register("skewer", { exitCode: 0 });

		await expect(
			run({ command: ["skewer", "-m", "pe"] }),
		).resolves.toMatchObject({ exitCode: 0 });
	});

	it("matches an argv prefix, not just the executable", async () => {
		const run = createFakeSubprocessRunner();

		run.register(["bowtie2", "--version"], { stdout: ["2.3.2"] });
		run.register(["bowtie2", "-x"], { exitCode: 2 });

		await expect(
			run({ command: ["bowtie2", "--version"] }),
		).resolves.toMatchObject({ exitCode: 0 });
		await expect(run({ command: ["bowtie2", "-x", "idx"] })).rejects.toThrow(
			SubprocessFailedError,
		);
	});

	it("records every call with its full argv and options", async () => {
		const run = createFakeSubprocessRunner();

		await run({ command: ["bowtie2-build", "in.fa", "out"], cwd: "/work" });
		await run({ command: ["samtools", "view"] });

		expect(run.commands()).toEqual([
			["bowtie2-build", "in.fa", "out"],
			["samtools", "view"],
		]);
		expect(run.calls()[0]?.cwd).toBe("/work");
		expect(run.wasRun(["bowtie2-build"])).toBe(true);
		expect(run.wasRun(["hmmscan"])).toBe(false);
	});

	it("records a call that failed", async () => {
		const run = createFakeSubprocessRunner({ exitCode: 1 });

		await expect(run({ command: ["broken"] })).rejects.toThrow();

		expect(run.commands()).toEqual([["broken"]]);
	});
});
