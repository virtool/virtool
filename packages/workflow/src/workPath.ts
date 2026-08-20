import { mkdir, readdir, rm, stat } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { WorkflowError } from "./errors";

/** Whether the path exists and is something other than a directory. */
async function isNonDirectory(path: string): Promise<boolean> {
	try {
		return !(await stat(path)).isDirectory();
	} catch {
		// Anything unreadable is left to `rm`, which is far better placed to say
		// what went wrong than a guess made from a failed `stat` would be.
		return false;
	}
}

/**
 * Empty the per-run work directory, creating it if it does not exist, and
 * return its absolute path.
 *
 * There is no cleanup at the end of a run: the pod is destroyed instead, and
 * process exit reclaims everything.
 *
 * @throws {WorkflowError} when the path is blank or resolves somewhere with no
 *   parent directory.
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

	// A `VT_WORK_PATH` pointing at a file — a mount misconfigured to a single
	// file, a typo landing on one — would otherwise be deleted and silently
	// replaced with a directory.
	if (await isNonDirectory(resolved)) {
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
