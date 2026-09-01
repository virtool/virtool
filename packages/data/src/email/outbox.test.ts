import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Db } from "../db/pg";
import { type EmailOutboxRow, emailOutbox } from "../db/schema/emailOutbox";
import { createTestDatabase, type TestDatabase } from "../db/test/fixtures";
import {
	claimDueEmails,
	countEmailOutbox,
	type EnqueueEmailInput,
	enqueueEmail,
	failEmail,
	markEmailAccepted,
	pruneEmailOutbox,
	releaseEmailClaim,
	scheduleEmailRetry,
} from "./outbox";

let database: TestDatabase;
let db: Db;

beforeAll(async () => {
	database = await createTestDatabase();
	db = database.db;
}, 60_000);

afterAll(async () => {
	await database.drop();
});

beforeEach(async () => {
	await db.delete(emailOutbox);
});

function input(overrides: Partial<EnqueueEmailInput> = {}): EnqueueEmailInput {
	return {
		idempotencyKey: "email_verification/1/1",
		recipient: "someone@example.com",
		template: {
			type: "email_verification",
			username: "alice",
			verifyUrl: "https://virtool.example/verify?token=abc",
		},
		...overrides,
	};
}

async function readRow(outboxId: number): Promise<EmailOutboxRow> {
	const [row] = await db
		.select()
		.from(emailOutbox)
		.where(eq(emailOutbox.id, outboxId));

	if (row === undefined) {
		throw new Error(`no outbox row with id ${outboxId}`);
	}

	return row;
}

const claimOptions = { claimToken: "claim-a", leaseSeconds: 120, limit: 10 };

describe("enqueueEmail", () => {
	it("creates a queued row with the template and version", async () => {
		const result = await enqueueEmail(db, input());

		expect(result.created).toBe(true);

		const row = await readRow(result.outboxId);

		expect(row.status).toBe("queued");
		expect(row.attempt_count).toBe(0);
		expect(row.template.type).toBe("email_verification");
		expect(row.template_version).toBe(1);
	});

	it("returns the existing row for a duplicate idempotency key", async () => {
		const first = await enqueueEmail(db, input());
		const second = await enqueueEmail(
			db,
			input({ recipient: "other@example.com" }),
		);

		expect(second).toEqual({ created: false, outboxId: first.outboxId });
		expect(
			await db.select({ id: emailOutbox.id }).from(emailOutbox),
		).toHaveLength(1);
	});

	it("resolves concurrent duplicate enqueues to one row", async () => {
		const results = await Promise.all(
			Array.from({ length: 8 }, () => enqueueEmail(db, input())),
		);

		const ids = new Set(results.map((result) => result.outboxId));

		expect(ids.size).toBe(1);
		expect(results.filter((result) => result.created)).toHaveLength(1);
	});

	it("participates in a caller's transaction", async () => {
		await db
			.transaction(async (tx) => {
				await enqueueEmail(tx, input());
				throw new Error("roll it back");
			})
			.catch(() => {});

		expect(
			await db.select({ id: emailOutbox.id }).from(emailOutbox),
		).toHaveLength(0);
	});

	it("honors notBefore", async () => {
		const future = new Date(Date.now() + 60 * 60 * 1000);

		await enqueueEmail(db, input({ notBefore: future }));

		expect(await claimDueEmails(db, claimOptions)).toEqual([]);
	});
});

describe("claimDueEmails", () => {
	it("claims a due row, incrementing its attempt count", async () => {
		const { outboxId } = await enqueueEmail(db, input());

		const claimed = await claimDueEmails(db, claimOptions);

		expect(claimed).toHaveLength(1);
		expect(claimed[0]?.id).toBe(outboxId);
		expect(claimed[0]?.attemptCount).toBe(1);

		const row = await readRow(outboxId);

		expect(row.claim_token).toBe("claim-a");
		expect(row.claim_expires_at).not.toBeNull();
	});

	it("does not hand a live claim to a second claimer", async () => {
		await enqueueEmail(db, input());

		await claimDueEmails(db, claimOptions);

		expect(
			await claimDueEmails(db, { ...claimOptions, claimToken: "claim-b" }),
		).toEqual([]);
	});

	it("reclaims a row whose claim expired", async () => {
		const { outboxId } = await enqueueEmail(db, input());

		await claimDueEmails(db, { ...claimOptions, leaseSeconds: 1 });

		await db
			.update(emailOutbox)
			.set({
				claim_expires_at: sql`timezone('utc', clock_timestamp()) - interval '1 second'`,
			})
			.where(eq(emailOutbox.id, outboxId));

		const reclaimed = await claimDueEmails(db, {
			...claimOptions,
			claimToken: "claim-b",
		});

		expect(reclaimed).toHaveLength(1);
		expect(reclaimed[0]?.attemptCount).toBe(2);
	});

	it("bounds the batch and takes the oldest-due rows first", async () => {
		for (let i = 0; i < 5; i++) {
			await enqueueEmail(db, input({ idempotencyKey: `key/${i}` }));
		}

		const claimed = await claimDueEmails(db, { ...claimOptions, limit: 3 });

		expect(claimed).toHaveLength(3);
		expect(claimed.map(({ idempotencyKey }) => idempotencyKey)).toEqual([
			"key/0",
			"key/1",
			"key/2",
		]);
	});

	it("ignores terminal rows", async () => {
		const { outboxId } = await enqueueEmail(db, input());
		const [claimed] = await claimDueEmails(db, claimOptions);

		if (!claimed) {
			throw new Error("expected a claim");
		}

		await failEmail(db, { outboxId, claimToken: "claim-a" }, "done");

		expect(
			await claimDueEmails(db, { ...claimOptions, claimToken: "claim-b" }),
		).toEqual([]);
	});
});

describe("fenced result writes", () => {
	async function claimOne(): Promise<number> {
		const { outboxId } = await enqueueEmail(db, input());
		const claimed = await claimDueEmails(db, claimOptions);

		expect(claimed).toHaveLength(1);

		return outboxId;
	}

	it("marks acceptance and releases the claim", async () => {
		const outboxId = await claimOne();

		await expect(
			markEmailAccepted(db, { outboxId, claimToken: "claim-a" }, "msg_1"),
		).resolves.toBe(true);

		const row = await readRow(outboxId);

		expect(row.status).toBe("accepted");
		expect(row.provider_message_id).toBe("msg_1");
		expect(row.accepted_at).not.toBeNull();
		expect(row.terminal_at).not.toBeNull();
		expect(row.claim_token).toBeNull();
	});

	it("refuses a result from a stale claim token", async () => {
		const outboxId = await claimOne();

		await expect(
			markEmailAccepted(db, { outboxId, claimToken: "claim-b" }, "msg_1"),
		).resolves.toBe(false);
		await expect(
			failEmail(db, { outboxId, claimToken: "claim-b" }, "nope"),
		).resolves.toBe(false);
		await expect(
			scheduleEmailRetry(db, { outboxId, claimToken: "claim-b" }, 30, "nope"),
		).resolves.toBe(false);

		expect((await readRow(outboxId)).status).toBe("queued");
	});

	it("refuses a second terminal write for the same row", async () => {
		const outboxId = await claimOne();

		await markEmailAccepted(db, { outboxId, claimToken: "claim-a" }, "msg_1");

		await expect(
			failEmail(db, { outboxId, claimToken: "claim-a" }, "late failure"),
		).resolves.toBe(false);

		expect((await readRow(outboxId)).status).toBe("accepted");
	});

	it("schedules a retry in the future and releases the claim", async () => {
		const outboxId = await claimOne();

		await expect(
			scheduleEmailRetry(
				db,
				{ outboxId, claimToken: "claim-a" },
				3600,
				"provider hiccup",
			),
		).resolves.toBe(true);

		const row = await readRow(outboxId);

		expect(row.status).toBe("queued");
		expect(row.last_error).toBe("provider hiccup");
		expect(row.claim_token).toBeNull();
		expect(row.next_attempt_at.getTime()).toBeGreaterThan(Date.now());
		expect(await claimDueEmails(db, claimOptions)).toEqual([]);
	});

	it("records a terminal failure with its error", async () => {
		const outboxId = await claimOne();

		await expect(
			failEmail(db, { outboxId, claimToken: "claim-a" }, "rejected"),
		).resolves.toBe(true);

		const row = await readRow(outboxId);

		expect(row.status).toBe("failed");
		expect(row.last_error).toBe("rejected");
		expect(row.terminal_at).not.toBeNull();
	});

	it("releases a claim without recording a result", async () => {
		const outboxId = await claimOne();

		await expect(
			releaseEmailClaim(db, { outboxId, claimToken: "claim-a" }),
		).resolves.toBe(true);

		const row = await readRow(outboxId);

		expect(row.status).toBe("queued");
		expect(row.claim_token).toBeNull();
		expect(row.attempt_count).toBe(0);
		expect(await claimDueEmails(db, claimOptions)).toHaveLength(1);
	});
});

describe("countEmailOutbox", () => {
	it("splits rows into queued, in-flight, accepted, and failed", async () => {
		await enqueueEmail(db, input({ idempotencyKey: "a" }));
		await enqueueEmail(db, input({ idempotencyKey: "b" }));
		await enqueueEmail(db, input({ idempotencyKey: "c" }));
		await enqueueEmail(db, input({ idempotencyKey: "d" }));

		const claimed = await claimDueEmails(db, { ...claimOptions, limit: 2 });

		expect(claimed).toHaveLength(2);

		await markEmailAccepted(
			db,
			{ outboxId: claimed[0]?.id ?? 0, claimToken: "claim-a" },
			"msg_1",
		);
		await failEmail(
			db,
			{ outboxId: claimed[1]?.id ?? 0, claimToken: "claim-a" },
			"bad",
		);

		await expect(countEmailOutbox(db)).resolves.toEqual({
			accepted: 1,
			failed: 1,
			inFlight: 0,
			queued: 2,
		});
	});

	it("counts a live claim as in flight", async () => {
		await enqueueEmail(db, input());
		await claimDueEmails(db, claimOptions);

		await expect(countEmailOutbox(db)).resolves.toEqual({
			accepted: 0,
			failed: 0,
			inFlight: 1,
			queued: 0,
		});
	});
});

describe("pruneEmailOutbox", () => {
	it("deletes terminal rows past their window and keeps the rest", async () => {
		const retention = { acceptedSeconds: 3600, failedSeconds: 7200 };

		async function seedTerminal(
			key: string,
			status: "accepted" | "failed",
			ageSeconds: number,
		): Promise<number> {
			const { outboxId } = await enqueueEmail(
				db,
				input({ idempotencyKey: key }),
			);

			await db
				.update(emailOutbox)
				.set({
					status,
					terminal_at: sql`timezone('utc', clock_timestamp()) - make_interval(secs => ${ageSeconds}::double precision)`,
				})
				.where(eq(emailOutbox.id, outboxId));

			return outboxId;
		}

		await seedTerminal("old-accepted", "accepted", 7000);
		const freshAccepted = await seedTerminal("fresh-accepted", "accepted", 60);
		await seedTerminal("old-failed", "failed", 10_000);
		const agingFailed = await seedTerminal("aging-failed", "failed", 7000);
		const { outboxId: queued } = await enqueueEmail(
			db,
			input({ idempotencyKey: "still-queued" }),
		);

		await expect(pruneEmailOutbox(db, retention)).resolves.toBe(2);

		const remaining = (
			await db.select({ id: emailOutbox.id }).from(emailOutbox)
		).map(({ id }) => id);

		expect(remaining.toSorted()).toEqual(
			[freshAccepted, agingFailed, queued].toSorted(),
		);
	});
});
