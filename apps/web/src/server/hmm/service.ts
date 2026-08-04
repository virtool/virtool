import type { Db } from "@virtool/data/db/pg";
import {
	attachInstallTask,
	fetchAndUpdateRelease,
	getUserHandle,
	HMM_INSTALL_TASK_TYPE,
	HmmInstallConflictError,
	type HmmInstalled,
	HmmReleaseError,
	isInstallInProgress,
} from "@virtool/data/hmm/data";
import { createTask } from "@virtool/data/tasks/data";

/**
 * Start an HMM install and return the pending install record.
 *
 * Mirrors the Python `HmmsData.install_update`: refuse if an install is already
 * running, refresh the release from the manifest, create the `install_hmms`
 * task the Python runner will claim, and point the status singleton at it.
 */
export async function installUpdate(
	db: Db,
	userId: number,
): Promise<HmmInstalled> {
	if (await isInstallInProgress(db)) {
		throw new HmmInstallConflictError("Install already in progress");
	}

	const release = await fetchAndUpdateRelease(db);

	if (!release) {
		throw new HmmReleaseError("Target release does not exist");
	}

	const update = await db.transaction(async (tx) => {
		// Re-check under a row lock. The guard above is a fast path that avoids
		// the manifest fetch, but on its own it races: two concurrent installs
		// could both pass it and each append a pending update. `fetchAndUpdateRelease`
		// has already upserted the status row, so `FOR UPDATE` has a row to lock
		// and serialises the second transaction behind the first.
		if (await isInstallInProgress(tx, { lock: true })) {
			throw new HmmInstallConflictError("Install already in progress");
		}

		const taskId = await createTask(tx, HMM_INSTALL_TASK_TYPE, {
			user_id: userId,
			release,
		});
		return attachInstallTask(tx, taskId, release, userId);
	});

	const handle = await getUserHandle(db, userId);

	return { ...update, user: { id: userId, handle } };
}
