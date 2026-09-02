import { randomBytes } from "node:crypto";
import {
	createKeyring,
	type EncryptedValue,
	type Keyring,
} from "@virtool/data/crypto/keyring";
import type { Db } from "@virtool/data/db/pg";
import { emailOutbox } from "@virtool/data/db/schema/emailOutbox";
import { settings } from "@virtool/data/db/schema/settings";
import { tasks } from "@virtool/data/db/schema/tasks";
import {
	createTestDatabase,
	type TestDatabase,
} from "@virtool/data/db/test/fixtures";
import { enqueueEmail } from "@virtool/data/email/outbox";
import {
	EMAIL_DELIVERY_DEADLINE_SECONDS,
	EMAIL_MAX_ATTEMPTS,
} from "@virtool/data/email/retry";
import {
	buildProviderIdempotencyKey,
	EMAIL_SEND_TIMEOUT_MS,
} from "@virtool/data/email/send";
import { seedSettings } from "@virtool/data/settings/test/fixtures";
import { TASK_WEDGE_SECONDS } from "@virtool/data/tasks/data";
import { createLogger, type Logger } from "@virtool/logger";
import { eq, sql } from "drizzle-orm";
import {
	afterAll,
	afterEach,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	vi,
} from "vitest";
import { runTask } from "../framework/run";
import type {
	EmailAttemptOutcome,
	EmailAvailabilityLabel,
} from "../metrics/registry";
import { claimTask, createTaskTestContext } from "../testing/tasks";
import {
	CLAIM_BATCH_SIZE,
	CLAIM_LEASE_SECONDS,
	deliverEmailTask,
	RUN_BUDGET_MS,
} from "./deliver-email";
import type { TaskContext } from "./registry";

const logger: Logger = createLogger({ name: "test", level: "silent" });

let database: TestDatabase;
let db: Db;

beforeAll(async () => {
	database = await createTestDatabase();
	db = database.db;
}, 60_000);

afterAll(async () => {
	await database.drop();
});

function keys(): Keyring {
	return createKeyring(randomBytes(32).toString("base64"), undefined);
}

function encrypt(keyring: Keyring, plaintext: string): EncryptedValue {
	const result = keyring.encrypt("resend_api_key", plaintext);

	if (!result.ok) {
		throw new Error("expected ready keyring");
	}

	return result.value;
}

const keyring = keys();

/** The metrics writers, recording every call for assertion. */
type RecordedMetrics = {
	attempts: [string, EmailAttemptOutcome][];
	availabilities: EmailAvailabilityLabel[];
	retries: string[];
	acceptedAges: number[];
	outboxSets: number;
};

let recorded: RecordedMetrics;
let ctx: TaskContext;

beforeEach(async () => {
	await db.delete(emailOutbox);
	await db.delete(settings);
	await db.delete(tasks);

	recorded = {
		attempts: [],
		availabilities: [],
		retries: [],
		acceptedAges: [],
		outboxSets: 0,
	};

	ctx = createTaskTestContext({
		db,
		keyring,
		metrics: {
			recordEmailAttempt: (template, outcome) => {
				recorded.attempts.push([template, outcome]);
			},
			recordEmailRetryScheduled: (template) => {
				recorded.retries.push(template);
			},
			observeEmailAcceptedAge: (seconds) => {
				recorded.acceptedAges.push(seconds);
			},
			setEmailOutbox: () => {
				recorded.outboxSets += 1;
			},
			setEmailAvailability: (availability) => {
				recorded.availabilities.push(availability);
			},
		},
	});
});

afterEach(() => {
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

const envelope = {
	replyToAddress: "",
	senderAddress: "noreply@virtool.example",
	senderName: "Virtool",
};

async function seedEmailSettings(
	overrides: { apiKey?: string; enabled?: boolean; withKey?: boolean } = {},
): Promise<void> {
	await seedSettings(db, {
		emailApiKey:
			(overrides.withKey ?? true)
				? encrypt(keyring, overrides.apiKey ?? "re_secret")
				: null,
		emailEnabled: overrides.enabled ?? true,
		emailSenderAddress: "noreply@virtool.example",
		emailSenderName: "Virtool",
	});
}

function jsonResponse(status: number, body: unknown): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "content-type": "application/json" },
	});
}

function stubSend(...responses: Response[]) {
	let call = 0;

	const fetchMock = vi.fn().mockImplementation(() => {
		const response = responses[Math.min(call, responses.length - 1)];
		call += 1;
		return Promise.resolve(response?.clone());
	});

	vi.stubGlobal("fetch", fetchMock);

	return fetchMock;
}

function providerError(
	status: number,
	name: string,
	retryAfterSeconds?: number,
): Response {
	const response = jsonResponse(status, {
		name,
		message: name,
		statusCode: status,
	});

	if (retryAfterSeconds !== undefined) {
		response.headers.set("retry-after", String(retryAfterSeconds));
	}

	return response;
}

async function runDrain(): Promise<void> {
	const task = await claimTask(db, deliverEmailTask);

	const outcome = await runTask({
		db,
		def: deliverEmailTask,
		task,
		ctx,
		logger,
		signal: new AbortController().signal,
	});

	expect(outcome).toEqual({ status: "completed" });
}

async function ageRow(outboxId: number, seconds: number): Promise<void> {
	await db
		.update(emailOutbox)
		.set({
			created_at: sql`timezone('utc', clock_timestamp()) - make_interval(secs => ${seconds}::double precision)`,
		})
		.where(eq(emailOutbox.id, outboxId));
}

/**
 * Move `performance.now` forward on demand, which is the clock the drain loop
 * measures its run budget on. The offset rides on the real reading, so nothing
 * else reading the same clock sees it go backwards.
 */
function stubElapsed(): {
	advance: (ms: number) => void;
	restore: () => void;
} {
	const real = performance.now.bind(performance);

	let offset = 0;

	const spy = vi
		.spyOn(performance, "now")
		.mockImplementation(() => real() + offset);

	return {
		advance(ms: number) {
			offset += ms;
		},
		restore() {
			spy.mockRestore();
		},
	};
}

async function readOutboxRow(outboxId: number) {
	const [row] = await db
		.select()
		.from(emailOutbox)
		.where(eq(emailOutbox.id, outboxId));

	if (row === undefined) {
		throw new Error(`no outbox row with id ${outboxId}`);
	}

	return row;
}

const template = {
	type: "email_verification",
	username: "alice",
	verifyUrl: "https://virtool.example/verify?token=abc",
} as const;

describe("deliverEmailTask", () => {
	it("sends a due row and records provider acceptance", async () => {
		await seedEmailSettings();

		const { outboxId } = await enqueueEmail(db, {
			idempotencyKey: "email_verification/1/1",
			recipient: "someone@example.com",
			template,
		});

		const fetchMock = stubSend(jsonResponse(200, { id: "msg_1" }));

		await runDrain();

		const row = await readOutboxRow(outboxId);

		expect(row.status).toBe("accepted");
		expect(row.provider_message_id).toBe("msg_1");

		const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];

		expect(new Headers(init.headers).get("Idempotency-Key")).toBe(
			buildProviderIdempotencyKey(outboxId, "email_verification/1/1", envelope),
		);

		expect(recorded.availabilities).toEqual(["ready"]);
		expect(recorded.attempts).toEqual([["email_verification", "accepted"]]);
		expect(recorded.acceptedAges).toHaveLength(1);
	});

	it("leaves rows queued and sends nothing while delivery is disabled", async () => {
		await seedEmailSettings({ enabled: false });
		await enqueueEmail(db, {
			idempotencyKey: "a",
			recipient: "someone@example.com",
			template,
		});

		const fetchMock = stubSend();

		await runDrain();

		expect(fetchMock).not.toHaveBeenCalled();
		expect(recorded.availabilities).toEqual(["disabled"]);
		expect(recorded.outboxSets).toBe(1);
	});

	it("reports unconfigured and sends nothing without a stored key", async () => {
		await seedEmailSettings({ withKey: false });

		const fetchMock = stubSend();

		await runDrain();

		expect(fetchMock).not.toHaveBeenCalled();
		expect(recorded.availabilities).toEqual(["unconfigured"]);
	});

	it("reports a configuration error and touches nothing when the key cannot be decrypted", async () => {
		await seedEmailSettings();
		ctx = { ...ctx, keyring: keys() };

		const { outboxId } = await enqueueEmail(db, {
			idempotencyKey: "a",
			recipient: "someone@example.com",
			template,
		});

		const fetchMock = stubSend();

		await runDrain();

		expect(fetchMock).not.toHaveBeenCalled();
		expect(recorded.availabilities).toEqual(["configuration_error"]);

		const row = await readOutboxRow(outboxId);

		expect(row.status).toBe("queued");
		expect(row.attempt_count).toBe(0);
	});

	it("schedules a retry for a retryable provider failure", async () => {
		await seedEmailSettings();

		const { outboxId } = await enqueueEmail(db, {
			idempotencyKey: "a",
			recipient: "someone@example.com",
			template,
		});

		stubSend(providerError(500, "internal_server_error"));

		await runDrain();

		const row = await readOutboxRow(outboxId);

		expect(row.status).toBe("queued");
		expect(row.attempt_count).toBe(1);
		expect(row.last_error).toContain("internal_server_error");
		expect(row.next_attempt_at.getTime()).toBeGreaterThan(Date.now());

		expect(recorded.attempts).toEqual([["email_verification", "retryable"]]);
		expect(recorded.retries).toEqual(["email_verification"]);
	});

	it("fails a row terminally on a permanent provider rejection", async () => {
		await seedEmailSettings();

		const { outboxId } = await enqueueEmail(db, {
			idempotencyKey: "a",
			recipient: "someone@example.com",
			template,
		});

		stubSend(providerError(422, "validation_error"));

		await runDrain();

		const row = await readOutboxRow(outboxId);

		expect(row.status).toBe("failed");
		expect(row.last_error).toContain("validation_error");
		expect(recorded.attempts).toEqual([["email_verification", "permanent"]]);
	});

	it("fails a row terminally once its attempts are exhausted", async () => {
		await seedEmailSettings();

		const { outboxId } = await enqueueEmail(db, {
			idempotencyKey: "a",
			recipient: "someone@example.com",
			template,
		});

		await db
			.update(emailOutbox)
			.set({ attempt_count: EMAIL_MAX_ATTEMPTS - 1 })
			.where(eq(emailOutbox.id, outboxId));

		stubSend(providerError(500, "internal_server_error"));

		await runDrain();

		const row = await readOutboxRow(outboxId);

		expect(row.status).toBe("failed");
		expect(row.last_error).toContain("retries exhausted");
		expect(recorded.attempts).toEqual([["email_verification", "exhausted"]]);
	});

	it("fails a row terminally once its delivery deadline has passed", async () => {
		await seedEmailSettings();

		const { outboxId } = await enqueueEmail(db, {
			idempotencyKey: "a",
			recipient: "someone@example.com",
			template,
		});

		await ageRow(outboxId, EMAIL_DELIVERY_DEADLINE_SECONDS + 3600);

		stubSend(providerError(500, "internal_server_error"));

		await runDrain();

		const row = await readOutboxRow(outboxId);

		expect(row.status).toBe("failed");
		expect(row.last_error).toContain("delivery deadline passed");
		expect(recorded.attempts).toEqual([["email_verification", "expired"]]);
		expect(recorded.retries).toEqual([]);
	});

	it("fails a rate-limited row past its deadline instead of waiting out the quota", async () => {
		await seedEmailSettings();

		const { outboxId } = await enqueueEmail(db, {
			idempotencyKey: "a",
			recipient: "someone@example.com",
			template,
		});

		await ageRow(outboxId, EMAIL_DELIVERY_DEADLINE_SECONDS + 3600);

		stubSend(providerError(429, "daily_quota_exceeded"));

		await runDrain();

		expect((await readOutboxRow(outboxId)).status).toBe("failed");
		expect(recorded.attempts).toEqual([["email_verification", "expired"]]);
	});

	it("keeps retrying a rate-limited row inside its deadline", async () => {
		await seedEmailSettings();

		const { outboxId } = await enqueueEmail(db, {
			idempotencyKey: "a",
			recipient: "someone@example.com",
			template,
		});

		await ageRow(outboxId, EMAIL_DELIVERY_DEADLINE_SECONDS - 3600);

		stubSend(providerError(429, "daily_quota_exceeded"));

		await runDrain();

		const row = await readOutboxRow(outboxId);

		expect(row.status).toBe("queued");
		expect(row.attempt_count).toBe(1);
		expect(row.next_attempt_at.getTime()).toBeGreaterThan(Date.now());
		expect(recorded.attempts).toEqual([["email_verification", "rate_limited"]]);
		expect(recorded.retries).toEqual(["email_verification"]);
	});

	it("clamps a long provider retry-after to the remaining deadline", async () => {
		await seedEmailSettings();

		const { outboxId } = await enqueueEmail(db, {
			idempotencyKey: "a",
			recipient: "someone@example.com",
			template,
		});

		const remainingSeconds = 600;

		await ageRow(outboxId, EMAIL_DELIVERY_DEADLINE_SECONDS - remainingSeconds);

		stubSend(providerError(429, "daily_quota_exceeded", 24 * 3600));

		await runDrain();

		const row = await readOutboxRow(outboxId);
		const waitSeconds = (row.next_attempt_at.getTime() - Date.now()) / 1000;

		expect(row.status).toBe("queued");
		expect(waitSeconds).toBeGreaterThan(0);
		expect(waitSeconds).toBeLessThanOrEqual(remainingSeconds);
	});

	it("stops the drain and releases the rows when the stored key is empty", async () => {
		await seedEmailSettings({ apiKey: "" });

		const first = await enqueueEmail(db, {
			idempotencyKey: "a",
			recipient: "someone@example.com",
			template,
		});
		await enqueueEmail(db, {
			idempotencyKey: "b",
			recipient: "someone@example.com",
			template,
		});

		const fetchMock = stubSend(jsonResponse(200, { id: "msg_1" }));

		await runDrain();

		expect(fetchMock).not.toHaveBeenCalled();
		expect(recorded.availabilities).toEqual(["ready", "configuration_error"]);

		const row = await readOutboxRow(first.outboxId);

		expect(row.status).toBe("queued");
		expect(row.claim_token).toBeNull();
		expect(
			(await db.select().from(emailOutbox)).every(
				(item) => item.status === "queued" && item.attempt_count === 0,
			),
		).toBe(true);
	});

	it("stops the drain and releases the row when the provider rejects the API key", async () => {
		await seedEmailSettings();

		const first = await enqueueEmail(db, {
			idempotencyKey: "a",
			recipient: "someone@example.com",
			template,
		});
		await enqueueEmail(db, {
			idempotencyKey: "b",
			recipient: "someone@example.com",
			template,
		});

		const fetchMock = stubSend(providerError(401, "invalid_api_key"));

		await runDrain();

		expect(fetchMock).toHaveBeenCalledTimes(1);
		expect(recorded.availabilities).toEqual(["ready", "configuration_error"]);

		const row = await readOutboxRow(first.outboxId);

		expect(row.status).toBe("queued");
		expect(row.claim_token).toBeNull();
		expect(row.attempt_count).toBe(0);
		expect(
			(await db.select().from(emailOutbox)).every(
				(item) => item.attempt_count === 0,
			),
		).toBe(true);
	});

	it("stops the drain after a rate limit, leaving the rest for the next run", async () => {
		await seedEmailSettings();

		const first = await enqueueEmail(db, {
			idempotencyKey: "a",
			recipient: "someone@example.com",
			template,
		});
		await enqueueEmail(db, {
			idempotencyKey: "b",
			recipient: "someone@example.com",
			template,
		});

		const fetchMock = stubSend(providerError(429, "rate_limit_exceeded"));

		await runDrain();

		expect(fetchMock).toHaveBeenCalledTimes(1);
		expect(recorded.attempts).toEqual([["email_verification", "rate_limited"]]);

		expect((await readOutboxRow(first.outboxId)).status).toBe("queued");
		expect((await readOutboxRow(first.outboxId)).attempt_count).toBe(1);
		expect(
			(await db.select().from(emailOutbox)).find(
				(item) => item.id !== first.outboxId,
			)?.attempt_count,
		).toBe(0);
	});

	it("fails queued rows with unsupported template versions", async () => {
		await seedEmailSettings();

		const { outboxId } = await enqueueEmail(db, {
			idempotencyKey: "unsupported-version",
			recipient: "someone@example.com",
			template,
		});

		await db
			.update(emailOutbox)
			.set({ template_version: 0 })
			.where(eq(emailOutbox.id, outboxId));

		const fetchMock = stubSend();

		await runDrain();

		expect(fetchMock).not.toHaveBeenCalled();
		expect((await readOutboxRow(outboxId)).status).toBe("failed");
		expect((await readOutboxRow(outboxId)).last_error).toContain(
			"unsupported email template version",
		);
		expect(recorded.attempts).toEqual([["email_verification", "permanent"]]);
	});

	it("drains multiple due rows in one run", async () => {
		await seedEmailSettings();

		for (let i = 0; i < 3; i++) {
			await enqueueEmail(db, {
				idempotencyKey: `key/${i}`,
				recipient: "someone@example.com",
				template,
			});
		}

		const fetchMock = stubSend(jsonResponse(200, { id: "msg" }));

		await runDrain();

		expect(fetchMock).toHaveBeenCalledTimes(3);
		expect(
			await db
				.select({ id: emailOutbox.id })
				.from(emailOutbox)
				.where(eq(emailOutbox.status, "accepted")),
		).toHaveLength(3);
	});

	it("leases a claim for at least the worst case of sending its whole batch", () => {
		expect(CLAIM_LEASE_SECONDS).toBeGreaterThanOrEqual(
			CLAIM_BATCH_SIZE * (EMAIL_SEND_TIMEOUT_MS / 1000),
		);
	});

	it("keeps a whole run inside the wedge ceiling, budget and last batch alike", () => {
		expect(RUN_BUDGET_MS / 1000 + CLAIM_LEASE_SECONDS).toBeLessThan(
			TASK_WEDGE_SECONDS,
		);
	});

	it("stops claiming new batches once the run budget passes", async () => {
		await seedEmailSettings();

		for (let i = 0; i < CLAIM_BATCH_SIZE + 1; i++) {
			await enqueueEmail(db, {
				idempotencyKey: `budget/${i}`,
				recipient: "someone@example.com",
				template,
			});
		}

		const clock = stubElapsed();

		const fetchMock = vi.fn().mockImplementation(() => {
			clock.advance(RUN_BUDGET_MS);

			return Promise.resolve(jsonResponse(200, { id: "msg" }));
		});

		vi.stubGlobal("fetch", fetchMock);

		await runDrain();

		expect(fetchMock).toHaveBeenCalledTimes(CLAIM_BATCH_SIZE);

		const remaining = (await db.select().from(emailOutbox)).filter(
			(row) => row.status === "queued",
		);

		expect(remaining).toHaveLength(1);
		expect(remaining[0]?.attempt_count).toBe(0);
		expect(remaining[0]?.claim_token).toBeNull();

		clock.restore();

		await runDrain();

		expect(
			await db
				.select({ id: emailOutbox.id })
				.from(emailOutbox)
				.where(eq(emailOutbox.status, "accepted")),
		).toHaveLength(CLAIM_BATCH_SIZE + 1);
	});

	it("prunes terminal rows past retention", async () => {
		await seedEmailSettings({ enabled: false });

		const { outboxId } = await enqueueEmail(db, {
			idempotencyKey: "old",
			recipient: "someone@example.com",
			template,
		});

		await db
			.update(emailOutbox)
			.set({
				status: "accepted",
				terminal_at: sql`timezone('utc', clock_timestamp()) - interval '30 days'`,
			})
			.where(eq(emailOutbox.id, outboxId));

		await runDrain();

		expect(
			await db.select({ id: emailOutbox.id }).from(emailOutbox),
		).toHaveLength(0);
	});
});
