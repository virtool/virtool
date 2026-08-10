import { describe, expect, it } from "vitest";
import {
	createFakeAnalysis,
	createFakeIndex,
	createFakeJob,
	createFakeJobClaimed,
	createFakeNewSample,
	createFakeNewSubtraction,
	createFakeReference,
	createFakeSample,
	createFakeSubtraction,
	SAMPLE_READ_FILENAMES,
	STATIC_TIME,
	SUBTRACTION_FILENAMES,
	staticTime,
} from "./builders";

describe("determinism", () => {
	// The whole point of seeding: D12 makes checksums the assertion, and a
	// fixture that changed between runs would make one unusable.
	it.each([
		["createFakeJob", createFakeJob],
		["createFakeSample", createFakeSample],
		["createFakeSubtraction", createFakeSubtraction],
		["createFakeIndex", createFakeIndex],
		["createFakeReference", createFakeReference],
		["createFakeAnalysis", createFakeAnalysis],
	])("%s produces identical values for the same seed", (_name, build) => {
		expect(build({}, 22)).toEqual(build({}, 22));
	});

	it("produces different values for different seeds", () => {
		expect(createFakeSample({}, 12).id).not.toBe(createFakeSample({}, 55).id);
	});

	it("mints storage keys that cannot be composed from the row id", () => {
		const sample = createFakeSample();

		for (const read of sample.reads) {
			expect(read.storageKey).toMatch(
				new RegExp(`^samples/${sample.id}/[0-9a-f]{32}$`),
			);
			expect(read.storageKey).not.toContain(read.name);
		}
	});
});

describe("static time", () => {
	it("pins the instant Python pins", () => {
		expect(STATIC_TIME).toBe("2015-10-06T20:00:00Z");
	});

	// A shared Date is module-level mutable state, and one test mutating it would
	// silently move every other test's fixtures.
	it("hands out a fresh Date each call", () => {
		const first = staticTime();
		const second = staticTime();

		expect(first).not.toBe(second);
		expect(first).toEqual(second);
	});

	it("stamps a job's timestamps with it", () => {
		const job = createFakeJob();

		expect(job.createdAt).toEqual(staticTime());
		expect(job.claimedAt).toEqual(staticTime());
	});
});

describe("overrides", () => {
	it("takes precedence over every seeded value", () => {
		expect(createFakeJob({ id: 77, state: "cancelled" })).toMatchObject({
			id: 77,
			state: "cancelled",
		});
	});
});

describe("fixture relationships", () => {
	it("gives a claimed job the same id and workflow as the job", () => {
		const job = createFakeJob();
		const claimed = createFakeJobClaimed();

		expect(claimed.id).toBe(job.id);
		expect(claimed.workflow).toBe(job.workflow);
		expect(claimed.key).toHaveLength(32);
	});

	it("gives a sample two reads files", () => {
		const sample = createFakeSample();

		expect(sample.paired).toBe(true);
		expect(sample.reads.map((read) => read.name)).toEqual([
			...SAMPLE_READ_FILENAMES,
		]);
	});

	it("gives a built subtraction its genome and all six Bowtie2 shards", () => {
		const subtraction = createFakeSubtraction();

		expect(subtraction.files.map((file) => file.name)).toEqual([
			...SUBTRACTION_FILENAMES,
		]);
		expect(
			subtraction.files.filter((file) => file.type === "bowtie2"),
		).toHaveLength(6);
		expect(subtraction.ready).toBe(true);
	});

	it("wires an analysis to its sample, index, reference and subtraction", () => {
		const analysis = createFakeAnalysis();

		expect(analysis.sample.id).toBe(createFakeSample().id);
		expect(analysis.index.id).toBe(createFakeIndex().id);
		expect(analysis.reference.id).toBe(createFakeReference().id);
		expect(analysis.subtractions[0]?.id).toBe(createFakeSubtraction().id);
	});
});

describe("unfinished resources", () => {
	it("gives a new sample no quality and no reads", () => {
		const sample = createFakeNewSample();

		expect(sample.quality).toBeNull();
		expect(sample.reads).toEqual([]);
	});

	it("gives a new subtraction nothing the workflow has not computed yet", () => {
		const subtraction = createFakeNewSubtraction();

		expect(subtraction).toMatchObject({
			count: null,
			files: [],
			gc: null,
			ready: false,
		});
	});
});
