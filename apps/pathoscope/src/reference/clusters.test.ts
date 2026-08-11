import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, onTestFinished } from "vitest";
import { parseCdHitClusters } from "./clusters";

async function withClusterFile(contents: string): Promise<string> {
	const directory = await mkdtemp(join(tmpdir(), "pathoscope-clusters-"));

	onTestFinished(() => rm(directory, { force: true, recursive: true }));

	const path = join(directory, "otu-1-segment-.cdhit.clstr");

	await writeFile(path, contents);

	return path;
}

describe("parseCdHitClusters", () => {
	it("maps every member of a cluster to the starred representative", async () => {
		const path = await withClusterFile(
			[
				">Cluster 0",
				"0\t1200nt, >seq_1... *",
				"1\t1198nt, >seq_2... at +/99.83%",
				"2\t1195nt, >seq_3... at +/99.41%",
				"",
			].join("\n"),
		);

		expect([...(await parseCdHitClusters(path))]).toEqual([
			["seq_1", "seq_1"],
			["seq_2", "seq_1"],
			["seq_3", "seq_1"],
		]);
	});

	// cd-hit-est writes no terminator after its last cluster, so a parser that
	// only flushes on the next `>Cluster` drops it — and for a single-cluster file
	// that is the whole result.
	it("flushes the trailing cluster after EOF", async () => {
		const path = await withClusterFile(
			[
				">Cluster 0",
				"0\t1200nt, >seq_1... *",
				">Cluster 1",
				"0\t900nt, >seq_2... *",
				"1\t899nt, >seq_3... at +/99.10%",
				"",
			].join("\n"),
		);

		const representatives = await parseCdHitClusters(path);

		expect(representatives.get("seq_2")).toBe("seq_2");
		expect(representatives.get("seq_3")).toBe("seq_2");
	});

	it("handles a file with exactly one cluster", async () => {
		const path = await withClusterFile(">Cluster 0\n0\t1200nt, >only... *\n");

		expect([...(await parseCdHitClusters(path))]).toEqual([["only", "only"]]);
	});

	it("keeps a representative that is not the first member", async () => {
		const path = await withClusterFile(
			[
				">Cluster 0",
				"0\t1198nt, >seq_2... at +/99.83%",
				"1\t1200nt, >seq_1... *",
				"",
			].join("\n"),
		);

		const representatives = await parseCdHitClusters(path);

		expect(representatives.get("seq_1")).toBe("seq_1");
		expect(representatives.get("seq_2")).toBe("seq_1");
	});

	// cd-hit-est does not produce one, and Python treats it as a no-op rather
	// than an error.
	it("drops a cluster with no representative", async () => {
		const path = await withClusterFile(
			[
				">Cluster 0",
				"0\t1198nt, >orphan... at +/99.83%",
				">Cluster 1",
				"0\t900nt, >seq_2... *",
				"",
			].join("\n"),
		);

		const representatives = await parseCdHitClusters(path);

		expect(representatives.has("orphan")).toBe(false);
		expect(representatives.get("seq_2")).toBe("seq_2");
	});

	it("reads a sequence id containing dots and hyphens", async () => {
		const path = await withClusterFile(
			">Cluster 0\n0\t1200nt, >NC_001.2-a... *\n",
		);

		expect([...(await parseCdHitClusters(path))]).toEqual([
			["NC_001.2-a", "NC_001.2-a"],
		]);
	});

	it("ignores lines that name no sequence", async () => {
		const path = await withClusterFile(
			["", ">Cluster 0", "   ", "0\t1200nt, >seq_1... *", ""].join("\n"),
		);

		expect([...(await parseCdHitClusters(path))]).toEqual([["seq_1", "seq_1"]]);
	});
});
