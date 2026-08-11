import { describe, expect, it } from "vitest";
import { deriveCacheKey } from "../cache/key";
import { createFakeSubprocessRunner } from "../testing/subprocess";
import {
	buildMappingIndexCacheParams,
	getBowtie2BuildVersion,
} from "./mappingIndex";

const TOOL_VERSION = "2.5.4";
const WORKFLOW_VERSION = "5.2.1";

function params(overrides: { workflow?: "nuvs" | "pathoscope" } = {}) {
	return buildMappingIndexCacheParams({
		indexKind: "subtraction_mapping_index",
		parentId: 7,
		toolVersion: TOOL_VERSION,
		workflow: overrides.workflow ?? "pathoscope",
		workflowVersion: WORKFLOW_VERSION,
	});
}

describe("buildMappingIndexCacheParams", () => {
	// The byte-exact keys are pinned against Python in each workflow app, which
	// is where the `extra` params describing the built FASTA live. What is
	// generic — the field set and their types — belongs here.
	it("names the tool rather than leaving it to the caller", () => {
		expect(params()).toMatchObject({
			index_kind: "subtraction_mapping_index",
			tool_name: "bowtie2-build",
			tool_version: TOOL_VERSION,
			workflow: "pathoscope",
			workflow_version: WORKFLOW_VERSION,
		});
	});

	// Python's type hint says `str` but both call sites pass an `int`, and
	// `json.dumps` writes `"parent_id":7` where a string gives `"parent_id":"7"`.
	it("sends parent_id as a number", () => {
		expect(params().parent_id).toBe(7);

		expect(deriveCacheKey({ ...params(), parent_id: "7" })).not.toBe(
			deriveCacheKey(params()),
		);
	});

	// The reason the workflow name is a parameter at all: two workflows building
	// a bowtie2 index off the same subtraction must not share a key, because each
	// shares that key with its own Python counterpart instead.
	it("derives a different key per workflow", () => {
		expect(deriveCacheKey(params({ workflow: "nuvs" }))).not.toBe(
			deriveCacheKey(params({ workflow: "pathoscope" })),
		);
	});

	it("lets extra params describe the fasta the index was built from", () => {
		const withExtra = buildMappingIndexCacheParams({
			extra: { source: "index_sqlite" },
			indexKind: "reference_mapping_index",
			parentId: 42,
			toolVersion: TOOL_VERSION,
			workflow: "nuvs",
			workflowVersion: WORKFLOW_VERSION,
		});

		expect(withExtra.source).toBe("index_sqlite");
	});
});

describe("getBowtie2BuildVersion", () => {
	it("reads the version from stdout", async () => {
		const runSubprocess = createFakeSubprocessRunner();

		runSubprocess.register("bowtie2-build", {
			stdout: ["/usr/local/bin/bowtie2-build-s version 2.5.4", "64-bit"],
		});

		await expect(getBowtie2BuildVersion(runSubprocess)).resolves.toBe("2.5.4");
	});

	it("throws when the output carries no version", async () => {
		const runSubprocess = createFakeSubprocessRunner();

		runSubprocess.register("bowtie2-build", { stdout: ["nothing here"] });

		await expect(getBowtie2BuildVersion(runSubprocess)).rejects.toThrow(
			"Could not parse bowtie2-build version",
		);
	});
});
