import { randomBytes } from "node:crypto";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { PgClient } from "../db/pg";
import {
	POOL_PROBE_TIMEOUT_MS,
	readConnectionCounts,
	readConnectionCountsBounded,
} from "./data";

// `readConnectionCounts` reads `pg_stat_activity` and touches no application
// table, so it needs a live connection rather than the schema `createTestDatabase`
// applies. Test files run in parallel against the one shared container, so each
// gets a unique application name — that is the whole point of the filter under
// test, and without it these suites would count each other's connections.
const applicationName = `metrics-test-${randomBytes(6).toString("hex")}`;

let reader: PgClient;
let other: PgClient;

beforeAll(() => {
	const url = process.env.VT_POSTGRES_URL as string;

	reader = postgres(url, {
		max: 1,
		connection: { application_name: applicationName },
	}) as PgClient;

	other = postgres(url, {
		max: 1,
		connection: { application_name: applicationName },
	}) as PgClient;
});

afterAll(async () => {
	await Promise.all([reader.end(), other.end()]);
});

describe("readConnectionCounts", () => {
	it("counts the backend running the query as active", async () => {
		const counts = await readConnectionCounts(reader, applicationName);

		expect(counts.active).toBe(1);
	});

	it("counts a connected but unoccupied backend as idle", async () => {
		await other`SELECT 1`;

		const counts = await readConnectionCounts(reader, applicationName);

		expect(counts).toEqual({
			active: 1,
			idle: 1,
			idleInTransaction: 0,
			other: 0,
		});
	});

	it("buckets a backend holding an open transaction separately", async () => {
		await other.begin(async (tx) => {
			await tx`SELECT 1`;

			const counts = await readConnectionCounts(reader, applicationName);

			expect(counts.idleInTransaction).toBe(1);
			expect(counts.idle).toBe(0);
		});
	});

	it("ignores backends belonging to another application name", async () => {
		const counts = await readConnectionCounts(
			reader,
			`${applicationName}-absent`,
		);

		expect(counts).toEqual({
			active: 0,
			idle: 0,
			idleInTransaction: 0,
			other: 0,
		});
	});
});

describe("readConnectionCountsBounded", () => {
	it("returns the counts when the probe answers in time", async () => {
		const counts = await readConnectionCountsBounded(reader, applicationName);

		expect(counts.active).toBe(1);
	});

	// A saturated pool queues the probe client-side, inside the postgres.js
	// closure, where nothing rejects and no statement timeout applies. Without
	// this deadline a scrape would hang past Prometheus' own timeout and lose the
	// entire response — process and request metrics included — in exactly the
	// situation the pool gauges exist to diagnose.
	it("rejects rather than hanging when the probe never settles", async () => {
		// postgres.js clients are called as a tagged template, so a function that
		// returns a forever-pending promise stands in for a query queued behind a
		// full pool.
		const never = (() => new Promise(() => {})) as unknown as PgClient;

		await expect(
			readConnectionCountsBounded(never, applicationName, 10),
		).rejects.toThrow("timed out");
	});

	it("defaults to the shared probe timeout", () => {
		expect(POOL_PROBE_TIMEOUT_MS).toBe(2000);
	});
});
