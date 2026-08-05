import { seedUser } from "@virtool/data/auth/test/fixtures";
import type { Db } from "@virtool/data/db/pg";
import { jobs } from "@virtool/data/db/schema/jobs";
import { users } from "@virtool/data/db/schema/users";
import {
	createTestDatabase,
	type TestDatabase,
} from "@virtool/data/db/test/fixtures";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { seedJob } from "./test/fixtures";
import { hashToken, parseBasicAuthHeader, verifyJobRequest } from "./verify";

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

/** Build the request a runner sends, with `job-{id}:{key}` Basic credentials. */
function request(login: string, key: string): Request {
	return new Request("https://jobs.virtool.test/jobs/1/ping", {
		headers: {
			authorization: `Basic ${Buffer.from(`${login}:${key}`).toString("base64")}`,
		},
	});
}

// Fixed vectors, not a comparison against `@virtool/data`'s copy or Python's.
// This digest is what `jobs.key` holds, and Python writes that column — so the
// three implementations must agree forever. A test that ran the two TypeScript
// copies against each other would pass just as happily if both drifted away
// from Python together, which is the only drift that actually matters.
describe("hashToken", () => {
	it.each([
		["", "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"],
		[
			"virtool",
			"59361c0bb629b66b9b7a82c139fbf8658c0c137b3ae4c728bef20e1fca24c276",
		],
	])("hashes %j to its pinned digest", (input, digest) => {
		expect(hashToken(input)).toBe(digest);
	});
});

describe("parseBasicAuthHeader", () => {
	it("reads the login and key out of a well-formed header", () => {
		const encoded = Buffer.from("job-7:secret").toString("base64");

		expect(parseBasicAuthHeader(`Basic ${encoded}`)).toEqual({
			login: "job-7",
			key: "secret",
		});
	});

	// RFC 7235 makes the scheme case-insensitive, and clients do send `basic`.
	it("accepts the scheme in any case", () => {
		const encoded = Buffer.from("job-7:secret").toString("base64");

		expect(parseBasicAuthHeader(`basic ${encoded}`)?.login).toBe("job-7");
		expect(parseBasicAuthHeader(`BASIC ${encoded}`)?.login).toBe("job-7");
	});

	// The RFC allows one *or more* spaces between the scheme and the credentials.
	it("accepts extra whitespace around the scheme", () => {
		const encoded = Buffer.from("job-7:secret").toString("base64");

		expect(parseBasicAuthHeader(`  Basic   ${encoded}  `)?.login).toBe("job-7");
	});

	// A key is free to contain colons; only the first one separates.
	it("splits on the first colon only", () => {
		const encoded = Buffer.from("job-7:a:b:c").toString("base64");

		expect(parseBasicAuthHeader(`Basic ${encoded}`)?.key).toBe("a:b:c");
	});

	it.each([
		["a bearer token", "Bearer abcdef"],
		["a scheme with no credentials", "Basic"],
		["credentials with no scheme", Buffer.from("job-7:s").toString("base64")],
		["trailing junk", `Basic ${Buffer.from("job-7:s").toString("base64")} x`],
		["no separator", `Basic ${Buffer.from("job-7").toString("base64")}`],
		["an empty login", `Basic ${Buffer.from(":secret").toString("base64")}`],
		["an empty header", ""],
	])("rejects %s", (_, header) => {
		expect(parseBasicAuthHeader(header)).toBeNull();
	});
});

describe("verifyJobRequest", () => {
	it("resolves the job behind a well-formed credential", async () => {
		const job = await seedJob(db, userId);

		expect(
			await verifyJobRequest(db, request(`job-${job.id}`, job.key)),
		).toEqual({ jobId: job.id });
	});

	it("rejects a request carrying no authorization header", async () => {
		await seedJob(db, userId);

		const bare = new Request("https://jobs.virtool.test/jobs/1/ping");

		expect(await verifyJobRequest(db, bare)).toBeNull();
	});

	// The header format is shared with the user-facing API, so a cookie is the
	// obvious thing to reach for next. This service has no session model at all.
	it("never falls back to a session cookie", async () => {
		const job = await seedJob(db, userId);

		const withCookie = new Request("https://jobs.virtool.test/jobs/1/ping", {
			headers: { cookie: `session_id=anything; session_token=${job.key}` },
		});

		expect(await verifyJobRequest(db, withCookie)).toBeNull();
	});

	it("rejects a malformed authorization header", async () => {
		const job = await seedJob(db, userId);

		const bearer = new Request("https://jobs.virtool.test/jobs/1/ping", {
			headers: { authorization: `Bearer ${job.key}` },
		});

		expect(await verifyJobRequest(db, bearer)).toBeNull();
	});

	it("rejects the right key under the wrong job's id", async () => {
		const first = await seedJob(db, userId);
		const second = await seedJob(db, userId);

		expect(
			await verifyJobRequest(db, request(`job-${second.id}`, first.key)),
		).toBeNull();
	});

	it("rejects a wrong key", async () => {
		const job = await seedJob(db, userId);

		expect(
			await verifyJobRequest(db, request(`job-${job.id}`, "not-the-key")),
		).toBeNull();
	});

	// The stored value is the digest, so a caller who somehow read the column
	// must not be able to present it back as the secret.
	it("rejects the stored digest presented as the key", async () => {
		const job = await seedJob(db, userId);

		expect(
			await verifyJobRequest(db, request(`job-${job.id}`, hashToken(job.key))),
		).toBeNull();
	});

	it("rejects a job that has never been claimed", async () => {
		const job = await seedJob(db, userId, { withKey: false });

		expect(
			await verifyJobRequest(db, request(`job-${job.id}`, job.key)),
		).toBeNull();
	});

	it("rejects a job that does not exist", async () => {
		const job = await seedJob(db, userId);
		await db.delete(jobs);

		expect(
			await verifyJobRequest(db, request(`job-${job.id}`, job.key)),
		).toBeNull();
	});

	// Reaching a terminal state is the only thing that stops a key working —
	// there is no expiry and no revocation — so this is the whole of key
	// invalidation, and it has to hold for every one of the three states.
	it.each(["cancelled", "failed", "succeeded"])(
		"rejects a valid key for a job that has %s",
		async (state) => {
			const job = await seedJob(db, userId, { state });

			expect(
				await verifyJobRequest(db, request(`job-${job.id}`, job.key)),
			).toBeNull();
		},
	);

	it("accepts a valid key for a job that is still pending", async () => {
		const job = await seedJob(db, userId, { state: "pending" });

		expect(
			await verifyJobRequest(db, request(`job-${job.id}`, job.key)),
		).toEqual({ jobId: job.id });
	});

	// `apps/web` folds a handle before refusing a `job` prefix, because it
	// matches handles case-insensitively. Nothing here is a handle, so the
	// prefix is matched literally and a folded spelling is simply not a login.
	it.each(["JOB", "Job", "jOb"])(
		"rejects a %s-prefixed login",
		async (prefix) => {
			const job = await seedJob(db, userId);

			expect(
				await verifyJobRequest(db, request(`${prefix}-${job.id}`, job.key)),
			).toBeNull();
		},
	);

	// Python splits the login on "-" and checks only the first part, so the
	// anchored pattern here is the stricter of the two. Each of these would
	// otherwise reach the database as a job id.
	it.each([
		"job",
		"job-",
		"-1",
		"job_1",
		"job-1-2",
		"job-1x",
		"xjob-1",
		"job-+1",
		"job-1.0",
		"job- 1",
		"job-0x1",
	])("rejects %j as a login", async (login) => {
		const job = await seedJob(db, userId);

		expect(await verifyJobRequest(db, request(login, job.key))).toBeNull();
	});

	// `jobs.id` is a Postgres integer. Without the range screen this reaches the
	// driver and comes back as a range error — a 500, and a Sentry frame, for
	// what is only a bad credential.
	it("rejects an id too large for the column without erroring", async () => {
		await seedJob(db, userId);

		expect(
			await verifyJobRequest(db, request("job-99999999999999999999", "k")),
		).toBeNull();
	});

	it("rejects a zero id", async () => {
		await seedJob(db, userId);

		expect(await verifyJobRequest(db, request("job-0", "k"))).toBeNull();
	});
});
