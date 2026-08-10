import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * The directories a run lays out under its work path.
 *
 * Created on request rather than always, so a test that asserts on the tree it
 * produced is not asserting against six empty directories it did not make.
 */
export const WORK_PATH_SUBDIRECTORIES = [
	"reads",
	"uploads",
	"subtractions",
	"indexes",
	"hmms",
	"caches",
] as const;

/** A temporary work path and the disposer that removes it. */
export type TestWorkPath = {
	path: string;
	cleanup: () => Promise<void>;
};

/**
 * Make a unique work directory under the system temp directory.
 *
 * **Never a fixed path.** `createWorkPath` unconditionally `rm -rf`s its target
 * before recreating it, and Vitest runs test files in parallel processes — so a
 * shared path means one test deleting another's tree mid-run, which surfaces as
 * a missing file in whichever test happened to lose the race. `mkdtemp`
 * guarantees uniqueness per call, which covers both parallel files and repeated
 * calls within one.
 *
 * Cleanup is the caller's: register it with `onTestFinished` rather than a
 * global `afterEach`, which would tie every test in a file to one path.
 */
export async function createTestWorkPath(
	subdirectories: readonly string[] = [],
): Promise<TestWorkPath> {
	const path = await mkdtemp(join(tmpdir(), "virtool-workflow-"));

	await Promise.all(
		subdirectories.map((name) => mkdir(join(path, name), { recursive: true })),
	);

	return {
		path,
		cleanup: () => rm(path, { recursive: true, force: true }),
	};
}
