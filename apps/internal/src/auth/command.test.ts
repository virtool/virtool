import { chmod, mkdtemp, readFile, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { seedUser } from "@virtool/data/auth/test/fixtures";
import type { Db } from "@virtool/data/db/pg";
import { authAccounts } from "@virtool/data/db/schema/auth";
import { users } from "@virtool/data/db/schema/users";
import {
	createTestDatabase,
	type TestDatabase,
} from "@virtool/data/db/test/fixtures";
import { createLogger, type Logger } from "@virtool/logger";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { parseAuthCommand, runAuthCommand } from "./command";

const logger: Logger = createLogger({ name: "test", level: "silent" });

/** A `$2b$12$` hash, as a legacy `users.password` carries one. */
const LEGACY_HASH =
	"$2b$12$YZZHj6hv6jXthfSY0zt8oO0Sk47cjiLCTP.sQHRBYQJVJZ0ALjsxu";

let database: TestDatabase;
let db: Db;
let reportDir: string;

beforeAll(async () => {
	database = await createTestDatabase();
	db = database.db;
	reportDir = await mkdtemp(join(tmpdir(), "vt-auth-report-"));
}, 60_000);

afterAll(async () => {
	await database.drop();
});

beforeEach(async () => {
	await db.delete(users);
});

function reportPath(name: string): string {
	return join(reportDir, `${name}.json`);
}

async function seedEligible(handle: string, email: string): Promise<number> {
	return seedUser(db, {
		handle,
		email,
		password: Buffer.from(LEGACY_HASH, "utf8"),
	});
}

describe("parseAuthCommand", () => {
	it("audits when no mode is named", () => {
		expect(parseAuthCommand([])).toEqual({ mode: "audit" });
		expect(parseAuthCommand(["--report", "out.json"])).toEqual({
			mode: "audit",
			reportPath: "out.json",
		});
	});

	it("applies only when apply is named", () => {
		expect(parseAuthCommand(["apply"])).toEqual({ mode: "apply" });
		expect(parseAuthCommand(["audit"])).toEqual({ mode: "audit" });
	});

	it.each([
		["backfill"],
		["--report"],
		["--batch-size", "0"],
		["--batch-size", "half"],
		["--unknown"],
	])("rejects %j", (...argv) => {
		expect(() => parseAuthCommand(argv)).toThrow();
	});

	it("reads a batch size", () => {
		expect(parseAuthCommand(["apply", "--batch-size", "10"])).toEqual({
			mode: "apply",
			batchSize: 10,
		});
	});
});

describe("runAuthCommand", () => {
	it("writes nothing without an explicit apply", async () => {
		const userId = await seedEligible("alice", "alice@example.com");

		const code = await runAuthCommand(db, logger, []);

		expect(code).toBe(0);
		expect(await db.select().from(authAccounts)).toHaveLength(0);

		const [user] = await db.select().from(users);

		expect(user?.id).toBe(userId);
		expect(user?.authMigratedAt).toBeNull();
	});

	it("migrates on apply", async () => {
		const userId = await seedEligible("alice", "Alice@Example.com");

		const code = await runAuthCommand(db, logger, ["apply"]);

		expect(code).toBe(0);

		const [credential] = await db.select().from(authAccounts);

		expect(credential).toMatchObject({
			accountId: String(userId),
			providerId: "credential",
			userId,
		});
	});

	it("writes a report only the owner can read", async () => {
		await seedEligible("alice", "alice@example.com");
		await seedUser(db, { handle: "bob", email: "" });

		const path = reportPath("audit");

		expect(await runAuthCommand(db, logger, ["--report", path])).toBe(0);

		const report = JSON.parse(await readFile(path, "utf8"));

		expect(report).toMatchObject({
			version: 2,
			mode: "audit",
			users: 2,
			counts: {
				eligible: { active: 1, deactivated: 0 },
				blankEmail: { active: 1, deactivated: 0 },
			},
		});
		expect(Date.parse(report.generatedAt)).not.toBeNaN();

		const mode = (await stat(path)).mode & 0o777;

		expect(mode).toBe(0o600);
	});

	it("restricts an existing report before returning", async () => {
		await seedEligible("alice", "alice@example.com");
		const path = reportPath("existing");
		await writeFile(path, "old report");
		await chmod(path, 0o644);

		expect(await runAuthCommand(db, logger, ["--report", path])).toBe(0);

		expect((await stat(path)).mode & 0o777).toBe(0o600);
	});

	it("names no password hash in the report", async () => {
		await seedEligible("alice", "alice@example.com");

		const path = reportPath("redaction");

		await runAuthCommand(db, logger, ["apply", "--report", path]);

		const written = await readFile(path, "utf8");

		expect(written).not.toContain("$2b$");
		expect(written).not.toContain(LEGACY_HASH);
	});

	it("succeeds when the only finding is an incomplete user", async () => {
		await seedUser(db, { handle: "alice", email: "" });

		expect(await runAuthCommand(db, logger, ["apply"])).toBe(0);
	});

	it("fails when a user carries an unusable password", async () => {
		await seedUser(db, {
			handle: "alice",
			email: "alice@example.com",
			password: Buffer.from("not-a-hash"),
		});

		expect(await runAuthCommand(db, logger, ["apply"])).toBe(1);
	});

	it("fails on a bad argument", async () => {
		expect(await runAuthCommand(db, logger, ["backfill"])).toBe(1);
	});

	// Its own database rather than this file's: the check is about a schema that
	// does not carry the Better Auth tables, and dropping one out of the shared
	// instance would take every later test with it.
	it("fails when the Better Auth schema is absent", async () => {
		const scratch = await createTestDatabase();

		try {
			await scratch.db.execute(sql`drop table auth_accounts cascade`);

			expect(await runAuthCommand(scratch.db, logger, [])).toBe(1);
		} finally {
			await scratch.drop();
		}
	}, 60_000);
});
