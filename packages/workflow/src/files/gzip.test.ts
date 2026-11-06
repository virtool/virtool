import { chmod, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createRunSubprocess } from "../subprocess/execa";
import { SubprocessFailedError } from "../subprocess/types";
import {
	createFakeSubprocessRunner,
	createRecordingLogger,
	type FakeSubprocessRunner,
	registerFakePigz,
} from "../testing";
import { gzipFile, recompressBzip2File } from "./gzip";

const CONTENTS = ">contig_0\nACGTACGTACGT\n";

async function setup(): Promise<{
	dir: string;
	runSubprocess: FakeSubprocessRunner;
}> {
	const dir = await mkdtemp(join(tmpdir(), "workflow-gzip-"));
	const runSubprocess = createFakeSubprocessRunner();

	registerFakePigz(runSubprocess);

	return { dir, runSubprocess };
}

describe("gzipFile", () => {
	it("runs pigz with the run's core count and the target as its stdout", async () => {
		const { dir, runSubprocess } = await setup();
		const source = join(dir, "source.fa");

		await writeFile(source, CONTENTS);

		const target = join(dir, "nested", "source.fa.gz");

		await gzipFile({ proc: 6, runSubprocess, source, target });

		expect(runSubprocess.calls()[0]).toMatchObject({
			command: ["pigz", "-p", "6", "-c", source],
			stdoutFile: target,
		});

		// The nested target directory is half the assertion: pigz would fail on a
		// parent that does not exist.
		expect(gunzipSync(await readFile(target)).toString("utf8")).toBe(CONTENTS);
	});
});

/**
 * These run the real shell pipeline, because a fake runner can't show that a
 * failed decompression fails the run. Only the two tools are stand-ins.
 */
describe("recompressBzip2File", () => {
	afterEach(() => {
		vi.unstubAllEnvs();
	});

	/** Put stand-ins for both tools first on `PATH`. */
	async function stubTools(dir: string, lbzip2Script: string): Promise<void> {
		const bin = join(dir, "bin");

		await mkdir(bin);

		await Promise.all(
			[
				["lbzip2", lbzip2Script],
				["pigz", "#!/bin/sh\ncat\n"],
			].map(async ([name = "", script = ""]) => {
				await writeFile(join(bin, name), script);
				await chmod(join(bin, name), 0o755);
			}),
		);

		vi.stubEnv("PATH", `${bin}:${process.env.PATH}`);
	}

	function createRunner() {
		return createRunSubprocess({
			logger: createRecordingLogger().logger,
			signal: new AbortController().signal,
		});
	}

	it("pipes the decompressed bytes into the target", async () => {
		const { dir } = await setup();
		const source = join(dir, "it's $(a) read.fq.bz2");
		const target = join(dir, "nested", "reads.fq.gz");

		await stubTools(dir, '#!/bin/sh\nfor last; do :; done\ncat "$last"\n');
		await writeFile(source, CONTENTS);

		await recompressBzip2File({
			proc: 2,
			runSubprocess: createRunner(),
			source,
			target,
		});

		await expect(readFile(target, "utf8")).resolves.toBe(CONTENTS);
	});

	it("fails when decompression fails part way through", async () => {
		const { dir } = await setup();
		const source = join(dir, "reads.fq.bz2");

		await stubTools(dir, "#!/bin/sh\nprintf partial\nexit 1\n");
		await writeFile(source, CONTENTS);

		await expect(
			recompressBzip2File({
				proc: 2,
				runSubprocess: createRunner(),
				source,
				target: join(dir, "reads.fq.gz"),
			}),
		).rejects.toBeInstanceOf(SubprocessFailedError);
	});
});
