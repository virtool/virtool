import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { describe, expect, it } from "vitest";
import { createSubtractionIndexesStep } from "./createIndexes";
import { setupStep } from "./fixtures";

const BOWTIE2_BUILD = "bowtie2-build";
const SUBTRACTION_GENOME = "genome bytes";

/** The subtraction step over one subtraction whose genome is seeded in storage. */
async function setup() {
	const harness = await setupStep({ subtractionCount: 1 });
	const { data, runSubprocess, testStorage } = harness;

	const [subtraction] = data.subtractions;

	if (!subtraction) {
		throw new Error("setupStep made no subtraction");
	}

	const [genome] = await testStorage.seedSubtractionFiles(subtraction.id, [
		{ name: "subtraction.fa.gz", contents: SUBTRACTION_GENOME },
	]);

	subtraction.storageKey = genome?.storageKey ?? "";

	// Recorded as it is called: the step removes the genome on the way out.
	const builtFastas: string[] = [];

	runSubprocess.register([BOWTIE2_BUILD, "--version"], {
		stdout: [`${BOWTIE2_BUILD} version 2.4.4`],
	});

	return {
		...harness,
		builtFastas,
		subtraction,

		registerBuild(exitCode: number) {
			runSubprocess.register([BOWTIE2_BUILD, "--threads"], {
				async effect({ command }) {
					const [, , , fastaPath, indexPrefix] = command;

					builtFastas.push(await readFile(fastaPath ?? "", "utf8"));

					await mkdir(dirname(indexPrefix ?? ""), { recursive: true });
					await writeFile(`${indexPrefix}.1.bt2`, "built shard");
				},
				exitCode,
			});
		},
	};
}

describe("createSubtractionIndexesStep", () => {
	it("removes the genome once the index is built", async () => {
		const {
			builtFastas,
			context,
			jobsApiState,
			paths,
			registerBuild,
			subtraction,
		} = await setup();

		registerBuild(0);

		await createSubtractionIndexesStep.run(context);

		expect(builtFastas).toEqual([SUBTRACTION_GENOME]);
		expect(jobsApiState.cacheRegistrations).toHaveLength(1);

		await expect(
			readFile(
				`${paths.subtraction(subtraction.id).indexPrefix}.1.bt2`,
				"utf8",
			),
		).resolves.toBe("built shard");
		await expect(readFile(subtraction.path, "utf8")).rejects.toThrow(/ENOENT/);
	});

	it("removes the genome when the build fails", async () => {
		const { builtFastas, context, jobsApiState, registerBuild, subtraction } =
			await setup();

		registerBuild(1);

		await expect(createSubtractionIndexesStep.run(context)).rejects.toThrow();

		expect(builtFastas).toEqual([SUBTRACTION_GENOME]);
		expect(jobsApiState.cacheRegistrations).toEqual([]);
		await expect(readFile(subtraction.path, "utf8")).rejects.toThrow(/ENOENT/);
	});
});
