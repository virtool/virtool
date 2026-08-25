import type { JobState } from "@virtool/contracts";
import { seedUser } from "@virtool/data/auth/test/fixtures";
import type { Db } from "@virtool/data/db/pg";
import { jobs } from "@virtool/data/db/schema/jobs";
import { users } from "@virtool/data/db/schema/users";
import {
	createTestDatabase,
	type TestDatabase,
} from "@virtool/data/db/test/fixtures";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { requireJobRequest } from "./guard";
import { seedJob } from "./test/fixtures";

let database: TestDatabase;
let db: Db;
let userId: number;

beforeAll(async () => {
	database = await createTestDatabase();
	db = database.db;
}, 60_000);

afterAll(async () => {
	await database.drop();
});

beforeEach(async () => {
	await db.delete(jobs);
	await db.delete(users);

	userId = await seedUser(db);
});

function request(login: string, key: string): Request {
	return new Request("https://jobs.virtool.test/jobs/1/ping", {
		headers: {
			authorization: `Basic ${Buffer.from(`${login}:${key}`).toString("base64")}`,
		},
	});
}

describe("requireJobRequest", () => {
	it("returns the principal for a valid credential", async () => {
		const job = await seedJob(db, userId);

		expect(
			await requireJobRequest(db, request(`job-${job.id}`, job.key)),
		).toEqual({ jobId: job.id });
	});

	it("returns a 401 response rather than throwing", async () => {
		const bare = new Request("https://jobs.virtool.test/jobs/1/ping");

		const result = await requireJobRequest(db, bare);

		expect(result).toBeInstanceOf(Response);
		expect((result as Response).status).toBe(401);
	});

	// The header makes a browser prompt for credentials, and nothing that
	// reaches this service is a browser. A runner's key is minted once, at claim
	// time, so there is nothing for an interactive retry to supply.
	it("sends no WWW-Authenticate header", async () => {
		const bare = new Request("https://jobs.virtool.test/jobs/1/ping");

		const result = (await requireJobRequest(db, bare)) as Response;

		expect(result.headers.get("www-authenticate")).toBeNull();
	});

	// Every rejection short of a correct key has to look identical from outside.
	// A body or status that varied would tell a caller which of the checks
	// turned it away, and the most useful thing to learn that way is whether a
	// given job id exists.
	it("refuses every unauthenticated failure identically", async () => {
		const job = await seedJob(db, userId, { state: "succeeded" });

		const responses = await Promise.all(
			[
				new Request("https://jobs.virtool.test/jobs/1/ping"),
				request("job-1", "not-the-key"),
				request("job-99999999", "not-the-key"),
				request("alice", job.key),
				// The right job, in a terminal state, but the wrong key. Nothing
				// about the state may reach a caller who has not proved it holds one.
				request(`job-${job.id}`, "not-the-key"),
			].map((each) => requireJobRequest(db, each)),
		);

		for (const response of responses) {
			expect(response).toBeInstanceOf(Response);
			expect((response as Response).status).toBe(401);
			expect(await (response as Response).text()).toBe("Unauthorized");
		}
	});

	// The runner's only channel. A ping refused with three indistinguishable
	// 401s leaves a cancellation, a ping-timeout sweep and a broken credential
	// looking the same in the logs of a pod that has just stopped working.
	it.each<[JobState, string]>([
		["cancelled", "Job is cancelled."],
		["failed", "Job has failed."],
		["succeeded", "Job has succeeded."],
	])("tells a key holder its job has %s", async (state, message) => {
		const job = await seedJob(db, userId, { state });

		const response = (await requireJobRequest(
			db,
			request(`job-${job.id}`, job.key),
		)) as Response;

		expect(response.status).toBe(401);
		expect(await response.json()).toEqual({ message });
	});
});
