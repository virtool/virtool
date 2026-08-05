import { randomBytes } from "node:crypto";

import { hashToken } from "@virtool/data/auth/tokens";
import type { Db } from "@virtool/data/db/pg";
import { jobs } from "@virtool/data/db/schema/jobs";

/** What {@link seedJob} accepts. */
export type SeedJobOptions = {
	/** One of the job lifecycle states. `running` unless a test needs another. */
	state?: string;
	/** Leave `key` null, as it is on a job nobody has claimed. */
	withKey?: boolean;
	workflow?: string;
};

/** A seeded job and the plaintext key that authenticates as it. */
export type SeededJob = {
	id: number;
	key: string;
};

/**
 * Insert a job owned by `userId` and return its id with the plaintext key.
 *
 * Only the key's SHA-256 is stored, so the plaintext is returned — it is the
 * only way a test can build a credential for the job afterwards, exactly as a
 * runner only ever sees it in the claim response.
 *
 * The hashing here goes through `@virtool/data`'s `hashToken` rather than this
 * app's local copy, deliberately. Seeding with the copy under test would make
 * the verifier agree with itself no matter what either did; going through the
 * shared one means a test that authenticates successfully has also shown that
 * the two implementations produce the same digest.
 *
 * `withKey: false` leaves the column null, which is the state of a job that has
 * been created but never claimed.
 */
export async function seedJob(
	db: Db,
	userId: number,
	{
		state = "running",
		withKey = true,
		workflow = "pathoscope",
	}: SeedJobOptions = {},
): Promise<SeededJob> {
	const key = randomBytes(32).toString("hex");

	const [job] = await db
		.insert(jobs)
		.values({
			created_at: new Date(),
			key: withKey ? hashToken(key) : null,
			state,
			user_id: userId,
			workflow,
		})
		.returning({ id: jobs.id });

	if (!job) {
		throw new Error("failed to seed job");
	}

	return { id: job.id, key };
}
