import { seedUser } from "@virtool/data/auth/test/fixtures";
import type { Db } from "@virtool/data/db/pg";
import { caches } from "@virtool/data/db/schema/caches";
import { jobs } from "@virtool/data/db/schema/jobs";
import { users } from "@virtool/data/db/schema/users";
import {
	createTestDatabase,
	type TestDatabase,
} from "@virtool/data/db/test/fixtures";
import { createLogger } from "@virtool/logger";
import { cacheKey, MemoryStorage } from "@virtool/storage";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { seedJob } from "../auth/test/fixtures";
import {
	type CacheHandlerDeps,
	handleGetCache,
	handleRegisterCache,
} from "./handlers";

const UUID_A = "a".repeat(32);
const UUID_B = "b".repeat(32);

let database: TestDatabase;
let db: Db;
let storage: MemoryStorage;
let deps: CacheHandlerDeps;
let credential: string;

const logger = createLogger({ name: "test", level: "silent" });

beforeAll(async () => {
	database = await createTestDatabase();
	db = database.db;
}, 60_000);

afterAll(async () => {
	await database.drop();
});

beforeEach(async () => {
	await db.delete(caches);
	await db.delete(jobs);
	await db.delete(users);

	const job = await seedJob(db, await seedUser(db));

	credential = Buffer.from(`job-${job.id}:${job.key}`).toString("base64");
	storage = new MemoryStorage();
	deps = { db, storage, logger };
});

async function* body(text: string): AsyncIterable<Uint8Array> {
	yield new TextEncoder().encode(text);
}

function get(key: string, authenticated = true): Request {
	return new Request(
		`https://jobs.virtool.test/caches/${encodeURIComponent(key)}`,
		{
			headers: authenticated ? { authorization: `Basic ${credential}` } : {},
		},
	);
}

function post(payload: unknown, authenticated = true): Request {
	return new Request("https://jobs.virtool.test/caches", {
		method: "POST",
		headers: {
			"content-type": "application/json",
			...(authenticated ? { authorization: `Basic ${credential}` } : {}),
		},
		body: JSON.stringify(payload),
	});
}

describe("handleRegisterCache", () => {
	it("refuses an unauthenticated caller", async () => {
		const response = await handleRegisterCache(
			deps,
			post({ key: "k", uuid: UUID_A, params: {} }, false),
		);

		expect(response.status).toBe(401);
		expect(await db.select().from(caches)).toEqual([]);
	});

	it("registers a cache and answers 201 with camelCase fields", async () => {
		await storage.write(cacheKey(UUID_A), body("hello world!"));

		const response = await handleRegisterCache(
			deps,
			post({ key: "trimmed-reads:abc", uuid: UUID_A, params: { trim: true } }),
		);

		expect(response.status).toBe(201);
		expect(await response.json()).toEqual({
			id: expect.any(Number),
			key: "trimmed-reads:abc",
			storageKey: `caches/v1/${UUID_A}`,
			size: 12,
			params: { trim: true },
			createdAt: expect.any(String),
			lastAccessedAt: expect.any(String),
			created: true,
		});
	});

	// The declared size is not part of the contract at all, so a caller sending
	// one gets the server's reading regardless — the extra field is ignored.
	it("stores the size it read from storage, not one the caller sent", async () => {
		await storage.write(cacheKey(UUID_A), body("hello world!"));

		const response = await handleRegisterCache(
			deps,
			post({
				key: "trimmed-reads:abc",
				uuid: UUID_A,
				params: {},
				size: 999_999,
			}),
		);

		expect((await response.json()).size).toBe(12);
	});

	it("rejects a uuid that is not 32 hex characters", async () => {
		for (const uuid of ["", "not-a-uuid", "A".repeat(32), "a".repeat(31)]) {
			const response = await handleRegisterCache(
				deps,
				post({ key: "trimmed-reads:abc", uuid, params: {} }),
			);

			expect(response.status).toBe(400);
		}

		expect(await db.select().from(caches)).toEqual([]);
	});

	// The wire carries no storage key, so the only lever a caller has on the
	// object's location is the uuid — and a traversal-shaped one is not a uuid.
	// Without this, a job-authenticated caller could point a cache row at a
	// sample or index object, which Python's LRU eviction would then delete.
	it("cannot produce a row pointing outside caches/v1/", async () => {
		await storage.write("samples/1/reads_1.fq.gz", body("not a cache"));

		const response = await handleRegisterCache(
			deps,
			post({
				key: "trimmed-reads:abc",
				uuid: "../../samples/1/reads_1.fq.gz",
				params: {},
			}),
		);

		expect(response.status).toBe(400);
		expect(await db.select().from(caches)).toEqual([]);
	});

	it("rejects a storage key sent in place of a uuid", async () => {
		const response = await handleRegisterCache(
			deps,
			post({
				key: "trimmed-reads:abc",
				uuid: `caches/v1/${UUID_A}`,
				params: {},
			}),
		);

		expect(response.status).toBe(400);
	});

	it("answers 400 and writes no row when the uuid names no object", async () => {
		const response = await handleRegisterCache(
			deps,
			post({ key: "trimmed-reads:abc", uuid: UUID_A, params: {} }),
		);

		expect(response.status).toBe(400);
		expect(await db.select().from(caches)).toEqual([]);
	});

	it("answers 400 for a malformed body", async () => {
		const request = new Request("https://jobs.virtool.test/caches", {
			method: "POST",
			headers: {
				authorization: `Basic ${credential}`,
				"content-type": "application/json",
			},
			body: "{",
		});

		expect((await handleRegisterCache(deps, request)).status).toBe(400);
	});

	// Both derived the same key and wrote the same bytes. The loser is pointed at
	// the winner's blob and its own orphan is reclaimed, because an orphan has no
	// row for Python's LRU eviction to walk.
	it("answers 200 with the winner's row when the key already exists", async () => {
		await storage.write(cacheKey(UUID_A), body("aaa"));
		await storage.write(cacheKey(UUID_B), body("aaa"));

		const first = await handleRegisterCache(
			deps,
			post({ key: "trimmed-reads:abc", uuid: UUID_A, params: {} }),
		);
		const second = await handleRegisterCache(
			deps,
			post({ key: "trimmed-reads:abc", uuid: UUID_B, params: {} }),
		);

		expect(first.status).toBe(201);
		expect(second.status).toBe(200);

		const winner = await first.json();
		const loser = await second.json();

		expect(loser.created).toBe(false);
		expect(loser.id).toBe(winner.id);
		expect(loser.storageKey).toBe(winner.storageKey);

		await expect(storage.size(cacheKey(UUID_A))).resolves.toBe(3);
		await expect(storage.size(cacheKey(UUID_B))).rejects.toThrow();
		expect(await db.select().from(caches)).toHaveLength(1);
	});

	// A lost response or an ordinary client retry re-sends the same uuid. That
	// re-selects the caller's own row, so the object it names must survive — a
	// row pointing at a deleted blob is unreadable and unrepairable.
	it("leaves the object in place when a retry repeats the same uuid", async () => {
		await storage.write(cacheKey(UUID_A), body("hello world!"));

		const payload = {
			key: "trimmed-reads:abc",
			uuid: UUID_A,
			params: {},
		};

		const first = await handleRegisterCache(deps, post(payload));
		const retry = await handleRegisterCache(deps, post(payload));

		expect(first.status).toBe(201);
		expect(retry.status).toBe(200);
		expect((await retry.json()).created).toBe(false);

		// The whole point: the row the retry returned still resolves to bytes.
		const lookup = await handleGetCache(
			deps,
			get("trimmed-reads:abc"),
			"trimmed-reads:abc",
		);

		await expect(storage.size((await lookup.json()).storageKey)).resolves.toBe(
			12,
		);
	});
});

describe("handleGetCache", () => {
	it("refuses an unauthenticated caller", async () => {
		const response = await handleGetCache(
			deps,
			get("trimmed-reads:abc", false),
			"trimmed-reads:abc",
		);

		expect(response.status).toBe(401);
	});

	it("answers 404 for a key with no row", async () => {
		const response = await handleGetCache(
			deps,
			get("nothing-here"),
			"nothing-here",
		);

		expect(response.status).toBe(404);
	});

	// The point of the lookup path: without it a workflow cannot reach a cached
	// blob at all, because `storageKey` is a per-write uuid and is not derivable
	// from the cache key.
	it("resolves a registered key to the storage key and server-read size", async () => {
		await storage.write(cacheKey(UUID_A), body("hello world!"));

		await handleRegisterCache(
			deps,
			post({ key: "trimmed-reads:abc", uuid: UUID_A, params: { trim: true } }),
		);

		const response = await handleGetCache(
			deps,
			get("trimmed-reads:abc"),
			"trimmed-reads:abc",
		);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({
			id: expect.any(Number),
			key: "trimmed-reads:abc",
			storageKey: `caches/v1/${UUID_A}`,
			size: 12,
			params: { trim: true },
			createdAt: expect.any(String),
			lastAccessedAt: expect.any(String),
		});
	});

	// Metadata only. The workflow reads the bytes from the bucket itself, so a
	// body here would put this service back on the data path Python was on.
	it("relays no cache bytes", async () => {
		await storage.write(cacheKey(UUID_A), body("hello world!"));

		await handleRegisterCache(
			deps,
			post({ key: "trimmed-reads:abc", uuid: UUID_A, params: {} }),
		);

		const response = await handleGetCache(
			deps,
			get("trimmed-reads:abc"),
			"trimmed-reads:abc",
		);

		expect(response.headers.get("content-type")).toContain("application/json");
		expect(await response.text()).not.toContain("hello world!");
	});
});
