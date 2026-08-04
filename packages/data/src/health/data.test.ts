import type { Logger } from "@virtool/logger";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PgClient } from "../db/pg";
import { checkPostgres, summarizeReadiness } from "./data";

const logger = { warn: vi.fn(), info: vi.fn() } as unknown as Logger;

function fakePgClient(result: () => PromiseLike<unknown>): PgClient {
	return (() => result()) as unknown as PgClient;
}

describe("checkPostgres", () => {
	afterEach(() => {
		vi.useRealTimers();
	});

	it("reports ok when the query resolves", async () => {
		const client = fakePgClient(() => Promise.resolve([{ ok: 1 }]));
		expect(await checkPostgres(client, logger)).toEqual({ ok: true });
	});

	it("reports not ok when the query rejects", async () => {
		const client = fakePgClient(() => Promise.reject(new Error("down")));
		expect(await checkPostgres(client, logger)).toEqual({ ok: false });
	});

	it("reports not ok when the query exceeds the timeout", async () => {
		vi.useFakeTimers();
		const client = fakePgClient(() => new Promise(() => {}));
		const pending = checkPostgres(client, logger);
		await vi.advanceTimersByTimeAsync(5_000);
		expect(await pending).toEqual({ ok: false });
	});
});

describe("summarizeReadiness", () => {
	it("is ready with a 200 when postgres is ok", () => {
		expect(summarizeReadiness({ ok: true })).toEqual({
			status: "ready",
			statusCode: 200,
			checks: { postgres: { ok: true } },
		});
	});

	it("is unavailable with a 503 when postgres fails", () => {
		const report = summarizeReadiness({ ok: false });
		expect(report.status).toBe("unavailable");
		expect(report.statusCode).toBe(503);
	});
});
