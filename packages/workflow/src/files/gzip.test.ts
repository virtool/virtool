import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gunzipSync, gzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import {
	createFakeSubprocessRunner,
	type FakeSubprocessRunner,
	registerFakePigz,
} from "../testing";
import { gunzipFile, gzipFile } from "./gzip";

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

describe("gunzipFile", () => {
	it("runs pigz in decompress mode and leaves the source in place", async () => {
		const { dir, runSubprocess } = await setup();
		const source = join(dir, "genome.fa.gz");

		await writeFile(source, gzipSync(Buffer.from(CONTENTS)));

		const target = join(dir, "genome.fa");

		await gunzipFile({ proc: 2, runSubprocess, source, target });

		expect(runSubprocess.calls()[0]).toMatchObject({
			command: ["pigz", "-p", "2", "-d", "-c", source],
			stdoutFile: target,
		});

		await expect(readFile(target, "utf8")).resolves.toBe(CONTENTS);
		await expect(readFile(source)).resolves.toBeDefined();
	});
});
