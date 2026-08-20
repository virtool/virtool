import {
	chmod,
	mkdir,
	mkdtemp,
	readdir,
	readFile,
	stat,
	symlink,
	writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { isAbsolute, join, relative } from "node:path";
import { describe, expect, it, onTestFinished } from "vitest";
import { WorkflowError } from "./errors";
import { createWorkPath } from "./workPath";

async function makeTempDir(): Promise<string> {
	return mkdtemp(join(tmpdir(), "vt-work-path-"));
}

describe("createWorkPath", () => {
	it("creates the directory when it does not exist", async () => {
		const path = join(await makeTempDir(), "work");

		const created = await createWorkPath(path);

		expect(created).toBe(path);
		expect(await readdir(created)).toEqual([]);
	});

	it("empties an existing directory with contents", async () => {
		const path = await makeTempDir();

		await writeFile(join(path, "leftover.fq"), "stale");

		const created = await createWorkPath(path);

		expect(await readdir(created)).toEqual([]);
	});

	// A work path is routinely a volume mount, and rmdir on a mount point is
	// EBUSY however empty it is. Mounting needs privileges no test run has, so
	// the stand-in is a directory whose parent forbids unlinking it — the same
	// shape, reachable without root.
	it.skipIf(process.getuid?.() === 0)(
		"empties a directory it is not allowed to remove",
		async () => {
			const parent = await makeTempDir();
			const path = join(parent, "work");

			await mkdir(path);
			await writeFile(join(path, "leftover.fq"), "stale");
			await chmod(parent, 0o500);

			onTestFinished(() => chmod(parent, 0o700));

			const created = await createWorkPath(path);

			expect(created).toBe(path);
			expect(await readdir(created)).toEqual([]);
			await expect(stat(path).then((info) => info.isDirectory())).resolves.toBe(
				true,
			);
		},
	);

	it("returns an absolute path when given a relative one", async () => {
		const target = join(await makeTempDir(), "work");

		const created = await createWorkPath(relative(process.cwd(), target));

		expect(isAbsolute(created)).toBe(true);
		expect(created).toBe(target);
	});

	// The path comes from an environment variable and this function deletes it
	// unconditionally, so the guard matters more than the two lines it costs.
	it("refuses the filesystem root", async () => {
		await expect(createWorkPath("/")).rejects.toThrow(WorkflowError);
		await expect(createWorkPath("/")).rejects.toThrow(
			/has no parent directory/,
		);
	});

	// A mount misconfigured to a single file would otherwise be deleted and
	// silently replaced with a directory.
	it("refuses a path that exists and is not a directory", async () => {
		const path = join(await makeTempDir(), "not-a-directory");

		await writeFile(path, "important");

		await expect(createWorkPath(path)).rejects.toThrow(WorkflowError);
		await expect(createWorkPath(path)).rejects.toThrow(
			/exists and is not a directory/,
		);
		expect(await readFile(path, "utf8")).toBe("important");
	});

	// The root and file guards are lexical or follow the link, so a link is a way
	// around both: emptying `/tmp/work -> /` would empty the filesystem root.
	it("refuses a symbolic link", async () => {
		const parent = await makeTempDir();
		const target = join(parent, "target");
		const path = join(parent, "link");

		await mkdir(target);
		await writeFile(join(target, "important.fq"), "important");
		await symlink(target, path);

		await expect(createWorkPath(path)).rejects.toThrow(WorkflowError);
		await expect(createWorkPath(path)).rejects.toThrow(/symbolic link/);
		expect(await readdir(target)).toEqual(["important.fq"]);
	});

	it.each(["", "   "])("refuses a blank path", async (path) => {
		await expect(createWorkPath(path)).rejects.toThrow(WorkflowError);
		await expect(createWorkPath(path)).rejects.toThrow(/blank work path/);
	});
});
