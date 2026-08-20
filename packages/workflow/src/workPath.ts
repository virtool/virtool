import type { Stats } from "node:fs";
import { lstat, mkdir, readdir, rm } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { WorkflowError } from "./errors";

/** The path's own stats, or `null` when it cannot be read. */
async function statPath(path: string): Promise<Stats | null> {
	try {
		return await lstat(path);
	} catch {
		// Anything unreadable is left to `mkdir` to report.
		return null;
	}
}

/**
 * Empty the per-run work directory, creating it if it does not exist, and
 * return its absolute path.
 *
 * There is no cleanup at the end of a run: the pod is destroyed instead, and
 * process exit reclaims everything.
 *
 * @throws {WorkflowError} when the path is blank, has no parent directory, or
 *   is a symbolic link or a non-directory.
 */
export async function createWorkPath(path: string): Promise<string> {
	// This function unconditionally deletes its target and the target comes from
	// an environment variable, so the guard is worth more than the two lines it
	// costs.
	if (path.trim() === "") {
		throw new WorkflowError("refusing to use a blank work path");
	}

	const resolved = resolve(path);

	if (dirname(resolved) === resolved) {
		throw new WorkflowError(
			`refusing to use ${resolved} as a work path: it has no parent directory`,
		);
	}

	const stats = await statPath(resolved);

	// A link slips past the guards above: `/tmp/work -> /` resolves lexically and
	// stats as a directory, so emptying it would empty the filesystem root.
	if (stats?.isSymbolicLink()) {
		throw new WorkflowError(
			`refusing to use ${resolved} as a work path: it is a symbolic link`,
		);
	}

	// A `VT_WORK_PATH` pointing at a file — a mount misconfigured to a single
	// file, a typo landing on one — would otherwise be deleted and silently
	// replaced with a directory.
	if (stats && !stats.isDirectory()) {
		throw new WorkflowError(
			`refusing to use ${resolved} as a work path: it exists and is not a directory`,
		);
	}

	await mkdir(resolved, { recursive: true });

	// The contents go, the directory stays: a work path is routinely a volume
	// mount, and rmdir on a mount point is EBUSY however empty it is.
	const entries = await readdir(resolved);

	await Promise.all(
		entries.map((entry) =>
			rm(join(resolved, entry), { recursive: true, force: true }),
		),
	);

	return resolved;
}
