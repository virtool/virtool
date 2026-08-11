import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { cacheKey } from "@virtool/storage";
import { describe, expect, it, onTestFinished } from "vitest";
import { createFakeJobsApiClient } from "../testing/jobsApi/fake";
import { createJobsApiState } from "../testing/jobsApi/state";
import { createTestStorage } from "../testing/storage";
import { createTestWorkPath } from "../testing/workPath";
import { createWorkflowCache } from "./cache";

async function setup() {
	const { path, cleanup } = await createTestWorkPath();

	onTestFinished(cleanup);

	const state = createJobsApiState();
	const { storage } = createTestStorage();

	const cache = createWorkflowCache({
		client: createFakeJobsApiClient(state),
		storage,
		stagingPath: join(path, "caches"),
	});

	return { cache, path, state, storage };
}

/** A directory holding one file, the shape every cached artifact takes. */
async function seedArtifact(root: string, name: string): Promise<string> {
	const directory = join(root, name);

	await mkdir(directory, { recursive: true });
	await writeFile(join(directory, "reference.1.bt2"), "shard one");

	return directory;
}

describe("createWorkflowCache", () => {
	it("reports a miss for a key nothing registered", async () => {
		const { cache, path } = await setup();

		expect(await cache.get("absent", join(path, "restore"))).toBeNull();
	});

	it("round-trips an artifact directory through a put and a get", async () => {
		const { cache, path } = await setup();

		const source = await seedArtifact(path, "reference_index");

		expect(await cache.put("key-1", source, { index_kind: "x" })).toBe(true);

		const target = join(path, "restored");
		const restored = await cache.get("key-1", target);

		expect(restored).toBe(join(target, "reference_index"));

		// The top-level entry is the source's basename — Python's
		// `arcname=source.name` — so the restored tree lands at the same relative
		// path the writer built it at.
		expect(
			await readFile(
				join(target, "reference_index", "reference.1.bt2"),
				"utf8",
			),
		).toBe("shard one");
	});

	it("writes the blob before registering the row", async () => {
		const { cache, path, state, storage } = await setup();

		await cache.put("key-1", await seedArtifact(path, "reference_index"), {});

		expect(state.cacheRegistrations).toHaveLength(1);

		const uuid = state.cacheRegistrations[0]?.uuid ?? "";

		expect(uuid).toMatch(/^[0-9a-f]{32}$/);
		// A row registered ahead of its blob points at nothing; the next reader
		// would fail where it should have missed.
		await expect(storage.size(cacheKey(uuid))).resolves.toBeGreaterThan(0);
	});

	it("records the params it was given", async () => {
		const { cache, path, state } = await setup();

		await cache.put("key-1", await seedArtifact(path, "reference_index"), {
			index_kind: "reference_mapping_index",
			tool_name: "bowtie2-build",
		});

		expect(state.cacheRegistrations[0]?.params).toEqual({
			index_kind: "reference_mapping_index",
			tool_name: "bowtie2-build",
		});
	});

	// Two runs can legitimately derive the same key at once and both blobs hold
	// the same bytes, so the loser is handed the winner's row rather than an error.
	it("reports an already-registered key as not created", async () => {
		const { cache, path } = await setup();

		const source = await seedArtifact(path, "reference_index");

		expect(await cache.put("key-1", source, {})).toBe(true);
		expect(await cache.put("key-1", source, {})).toBe(false);
	});

	// The archive is a second copy of an artifact that runs to gigabytes, and a
	// one-shot pod's disk is sized for one.
	it("leaves no archive behind after a put", async () => {
		const { cache, path } = await setup();

		await cache.put("key-1", await seedArtifact(path, "reference_index"), {});

		expect(await readdir(join(path, "caches"))).toEqual([]);
	});
});
