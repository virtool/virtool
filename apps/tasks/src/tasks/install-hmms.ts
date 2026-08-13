import { createReadStream } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { extractTarMembers } from "@virtool/archive/tar";
import { HmmAnnotation } from "@virtool/contracts";
import { cleanHmmStatus, installHmms } from "@virtool/data/hmm/data";
import { z } from "zod";
import { downloadToFile } from "../download";
import { defineTask } from "../framework/define";
import type { TaskContext } from "./registry";

/**
 * `install_hmms` carries the release to install and who asked for it.
 *
 * `installUpdate` (`apps/web/src/server/hmm/service.ts`) is the only writer of
 * these rows; Python's HMM API no longer creates them. The release is spelled
 * out because `createUpdateSubdocument` copies nearly all of it onto the status
 * singleton, so a field missing here is missing from the install record.
 */
const payload = z.object({
	release: z.object({
		body: z.string(),
		content_type: z.string(),
		download_url: z.string(),
		filename: z.string(),
		html_url: z.string(),
		id: z.number().int(),
		name: z.string(),
		newer: z.boolean(),
		published_at: z.string(),
		retrieved_at: z.string(),
		size: z.number().int(),
	}),
	user_id: z.number().int(),
});

const ARCHIVE_NAME = "hmm.tar.gz";

// The paths Python's `decompress_tgz` leaves these at.
const ANNOTATIONS_MEMBER = "hmm/annotations.json";
const PROFILES_MEMBER = "hmm/profiles.hmm";

/**
 * Install an HMM release: download it, unpack it, and write it to the database
 * and object storage.
 *
 * The port of Python's `HMMInstallTask`. **Nothing in this repo set
 * `ready: true` before this body existed**, so the first install wedged
 * `isInstallInProgress` on and every install after it was refused.
 *
 * **The archive goes to disk rather than being piped through.** A fused
 * download → gunzip → untar cannot retry the download without redoing the
 * extraction, so the pod needs room for the `.tar.gz` and the extracted
 * profiles at once.
 *
 * **Both members are spooled in `decompress`.** Archive order is not
 * guaranteed, and the install needs annotations first and profiles last.
 *
 * Idempotent as a reclaim requires: the temp directory is fresh each run, and
 * `installHmms` short-circuits on a release already recorded installed.
 */
export const installHmmsTask = defineTask<typeof payload, TaskContext>({
	type: "install_hmms",
	payload,
	// Python names each step after the bound method it runs, `BaseTask.run`
	// writing `func.__name__` into the column. Both runners write the same three
	// names for the same work until the cutover completes.
	steps: ["download", "decompress", "install"],
	async run({ ctx, helpers, logger, payload, signal }) {
		const { release, user_id: userId } = payload;

		const workPath = await mkdtemp(join(tmpdir(), "vt-install-hmms-"));

		const archivePath = join(workPath, ARCHIVE_NAME);
		const annotationsPath = join(workPath, "annotations.json");
		const profilesPath = join(workPath, "profiles.hmm");

		try {
			await helpers.runStep("download", async (report) => {
				await downloadToFile(release.download_url, archivePath, {
					logger,
					signal,
					onProgress(received) {
						// Python's progress wrapper divides by the total unguarded, so a
						// manifest entry carrying `size: 0` is a ZeroDivisionError.
						if (release.size > 0) {
							report(received / release.size);
						}
					},
				});
			});

			// No progress: nothing worth publishing between the step boundaries the
			// framework already writes.
			await helpers.runStep("decompress", async () => {
				await extractTarMembers(
					archivePath,
					{
						[ANNOTATIONS_MEMBER]: annotationsPath,
						[PROFILES_MEMBER]: profilesPath,
					},
					{ gzip: true, signal },
				);
			});

			await helpers.runStep("install", async (report) => {
				const annotations = z
					.array(HmmAnnotation)
					.parse(JSON.parse(await readFile(annotationsPath, "utf8")));

				const performed = await installHmms(
					ctx.db,
					ctx.storage,
					logger,
					{
						annotations,
						// A factory: the short-circuit never reads it, and an opened
						// stream would leak its handle on every re-run.
						profiles: () => createReadStream(profilesPath),
						release,
						userId,
					},
					// `report` takes a fraction where the data layer publishes percent.
					async (percent) => {
						report(percent / 100);
					},
				);

				if (!performed) {
					logger.info(
						{ release_id: release.id },
						"hmm release was already installed, skipped",
					);
				}
			});
		} finally {
			// Every exit path, abort included: a pod that failed an install still
			// needs room for the retry.
			await rm(workPath, { force: true, recursive: true });
		}
	},
	async cleanup({ ctx, logger, reason }) {
		/*
		 * Python's `BaseTask` runs `cleanup` only on error, and this must match.
		 * `cleanHmmStatus` empties `updates`, which is what a re-run reads to tell
		 * whether the install already committed — so running it on a drain strips
		 * the entry the next attempt needs, and that attempt writes everything and
		 * records none of it.
		 */
		if (reason === "aborted") {
			return;
		}

		logger.info("clearing the hmm install status after a failed install");

		await cleanHmmStatus(ctx.db);
	},
});
