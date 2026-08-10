import { mkdir, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { describe, expect, it, onTestFinished } from "vitest";
import { createWorkPath } from "../workPath";
import { createTestWorkPath, WORK_PATH_SUBDIRECTORIES } from "./workPath";

describe("createTestWorkPath", () => {
	it("makes a directory under the system temp directory", async () => {
		const { path, cleanup } = await createTestWorkPath();

		onTestFinished(cleanup);

		expect(dirname(path)).toBe(tmpdir());
		expect(basename(path).startsWith("virtool-workflow-")).toBe(true);
		await expect(stat(path).then((info) => info.isDirectory())).resolves.toBe(
			true,
		);
	});

	// `createWorkPath` unconditionally `rm -rf`s its target and Vitest runs test
	// files in parallel processes, so a fixed path means one test deleting
	// another's tree mid-run.
	it("never hands out the same path twice", async () => {
		const paths = await Promise.all(
			Array.from({ length: 8 }, () => createTestWorkPath()),
		);

		onTestFinished(async () => {
			await Promise.all(paths.map(({ cleanup }) => cleanup()));
		});

		expect(new Set(paths.map(({ path }) => path)).size).toBe(8);
	});

	it("survives the runtime's own work-path preparation", async () => {
		const { path, cleanup } = await createTestWorkPath();

		onTestFinished(cleanup);

		await writeFile(join(path, "stale"), "left over");

		// The real thing empties and recreates its target. A test work path has to
		// be somewhere that can happen without touching anyone else's tree.
		await expect(createWorkPath(path)).resolves.toBe(path);
		await expect(stat(join(path, "stale"))).rejects.toThrow();
	});

	it("lays out the requested subdirectories and nothing else", async () => {
		const { path, cleanup } = await createTestWorkPath([
			...WORK_PATH_SUBDIRECTORIES,
		]);

		onTestFinished(cleanup);

		for (const name of WORK_PATH_SUBDIRECTORIES) {
			await expect(
				stat(join(path, name)).then((info) => info.isDirectory()),
			).resolves.toBe(true);
		}
	});

	it("makes no subdirectories by default", async () => {
		const { path, cleanup } = await createTestWorkPath();

		onTestFinished(cleanup);

		await expect(stat(join(path, "reads"))).rejects.toThrow();
	});

	it("removes the tree, and a second cleanup is not an error", async () => {
		const { path, cleanup } = await createTestWorkPath();

		await mkdir(join(path, "nested", "deeper"), { recursive: true });
		await writeFile(join(path, "nested", "deeper", "file"), "bytes");

		await cleanup();

		await expect(stat(path)).rejects.toThrow();
		await expect(cleanup()).resolves.toBeUndefined();
	});
});
