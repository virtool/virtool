import { hashPassword } from "@virtool/data/auth/password";
import { seedUser } from "@virtool/data/auth/test/fixtures";
import {
	getDataMigration,
	listDataMigrationFindings,
} from "@virtool/data/data-migrations/data";
import type { Db } from "@virtool/data/db/pg";
import { authAccounts } from "@virtool/data/db/schema/auth";
import { dataMigrations } from "@virtool/data/db/schema/dataMigrations";
import { users } from "@virtool/data/db/schema/users";
import {
	createTestDatabase,
	type TestDatabase,
} from "@virtool/data/db/test/fixtures";
import { createLogger } from "@virtool/logger";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, expect, it } from "vitest";
import { DATA_MIGRATIONS } from "./registry";
import { executeDataMigration } from "./run";

let database: TestDatabase;
let db: Db;
let password: Buffer;

beforeAll(async () => {
	database = await createTestDatabase();
	db = database.db;
	password = await hashPassword("legacy-password");
}, 60_000);

afterAll(async () => {
	await database.drop();
});

beforeEach(async () => {
	await db.delete(dataMigrations);
	await db.delete(users);
});

function runLegacyIdentities(signal = new AbortController().signal) {
	const definition = DATA_MIGRATIONS.legacy_identities;
	if (definition === undefined) {
		throw new Error("legacy identity migration is not registered");
	}

	return executeDataMigration(
		{
			db,
			client: database.client,
			logger: createLogger({ name: "test", level: "silent" }),
			signal,
		},
		definition,
	);
}

it("migrates eligible users while incomplete users remain a passing report", async () => {
	const eligible = await seedUser(db, {
		handle: "Ada",
		email: " Ada@Example.com ",
		password: await hashPassword("legacy-password"),
	});
	const incomplete = await seedUser(db, {
		handle: "incomplete",
		email: "",
		password,
	});

	const finished = await runLegacyIdentities();

	expect(finished).toMatchObject({
		version: 2,
		status: "passed",
		summary: {
			counts: {
				blankEmail: { active: 1, deactivated: 0 },
			},
			credentials: { inserted: 1 },
		},
	});
	expect(await listDataMigrationFindings(db, finished.id)).toHaveLength(0);
	expect(await db.select().from(authAccounts)).toMatchObject([
		{ userId: eligible },
	]);
	expect(
		(await db.select().from(users)).find((user) => user.id === incomplete),
	).toMatchObject({ authMigratedAt: null, email: "" });

	const rerun = await runLegacyIdentities();
	expect(rerun).toMatchObject({
		status: "passed",
		attempts: 2,
		summary: { credentials: { inserted: 0, alreadyPresent: 1 } },
	});
});

it("keeps unsafe identities actionable", async () => {
	const userId = await seedUser(db, {
		handle: "not valid",
		email: "invalid-handle@example.com",
		password: await hashPassword("legacy-password"),
	});

	const finished = await runLegacyIdentities();

	expect(finished.status).toBe("failed");
	expect(await listDataMigrationFindings(db, finished.id)).toMatchObject([
		{ code: "invalid_handle", subject: `user:${userId}` },
	]);
	expect(await getDataMigration(db, "legacy_identities", 2)).toMatchObject({
		status: "failed",
	});
	expect(await db.select().from(authAccounts)).toHaveLength(0);
});

it("blocks an invalid bcrypt password even with blank email", async () => {
	const id = await seedUser(db, {
		email: "",
		password: Buffer.from("private-invalid-password"),
	});
	const finished = await runLegacyIdentities();
	expect(finished.status).toBe("failed");
	const findings = await listDataMigrationFindings(db, finished.id);
	expect(findings).toMatchObject([
		{ code: "invalid_password", subject: `user:${id}` },
	]);
	expect(JSON.stringify({ finished, findings })).not.toContain(
		"private-invalid-password",
	);
	expect(await db.select().from(authAccounts)).toHaveLength(0);
});

it.each(["malformed", "duplicate@example.com"])(
	"blocks an invalid handle with incomplete email %s",
	async (email) => {
		const id = await seedUser(db, { handle: "not valid", email, password });
		if (email.includes("@")) {
			await seedUser(db, {
				handle: "duplicate",
				email: " DUPLICATE@example.com ",
				password,
			});
		}
		const finished = await runLegacyIdentities();
		expect(finished.status).toBe("failed");
		expect(await listDataMigrationFindings(db, finished.id)).toMatchObject([
			{ code: "invalid_handle", subject: `user:${id}` },
		]);
		expect(await db.select().from(authAccounts)).toHaveLength(0);
	},
);

it("leaves ordinary blank, malformed, and duplicate email users unchanged", async () => {
	for (const [handle, email] of [
		["blank", "  "],
		["malformed", "invalid"],
		["duplicate1", "same@example.com"],
		["duplicate2", " SAME@example.com "],
	] as const) {
		await seedUser(db, { handle, email, password });
	}
	const before = await db.select().from(users);
	const finished = await runLegacyIdentities();
	expect(finished).toMatchObject({
		status: "passed",
		summary: {
			users: 4,
			counts: {
				blankEmail: { active: 1 },
				invalidEmail: { active: 1 },
				duplicateEmail: { active: 2 },
			},
		},
	});
	expect(await db.select().from(users)).toEqual(before);
	expect(await db.select().from(authAccounts)).toHaveLength(0);
});

it.each(["missing", "unmarked", "foreign", "null"])(
	"blocks %s credential state despite incomplete email",
	async (state) => {
		const id = await seedUser(db, { handle: "owner", password });
		if (state === "missing" || state === "null") {
			await db
				.update(users)
				.set({ authMigratedAt: new Date() })
				.where(eq(users.id, id));
		}
		if (state !== "missing") {
			const owner =
				state === "foreign"
					? await seedUser(db, { handle: "other", password })
					: id;
			await db.insert(authAccounts).values({
				accountId: String(id),
				providerId: "credential",
				userId: owner,
				password: state === "null" ? null : password.toString("utf8"),
				createdAt: new Date(),
				updatedAt: new Date(),
			});
		}
		const before = await db.select().from(users);
		const accounts = await db.select().from(authAccounts);
		const finished = await runLegacyIdentities();
		expect(finished.status).toBe("failed");
		expect(await listDataMigrationFindings(db, finished.id)).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					code: "credential_conflict",
					subject: `user:${id}`,
				}),
			]),
		);
		expect(await db.select().from(users)).toEqual(before);
		expect(await db.select().from(authAccounts)).toEqual(accounts);
	},
);

it("repairs stale credentials and rejects invalid legacy passwords on migrated users", async () => {
	const id = await seedUser(db, { email: "valid@example.com", password });
	await runLegacyIdentities();
	await db.update(authAccounts).set({ password: "stale" });
	const repaired = await runLegacyIdentities();
	expect(repaired).toMatchObject({
		status: "passed",
		summary: { credentials: { updated: 1 } },
	});
	expect(await db.select().from(authAccounts)).toMatchObject([
		{ password: password.toString("utf8") },
	]);
	await db
		.update(users)
		.set({ password: Buffer.from("invalid") })
		.where(eq(users.id, id));
	const failed = await runLegacyIdentities();
	expect(failed.status).toBe("failed");
	expect(await listDataMigrationFindings(db, failed.id)).toMatchObject([
		{ code: "invalid_password" },
	]);
	expect(await db.select().from(authAccounts)).toMatchObject([
		{ password: password.toString("utf8") },
	]);
});

it("observes cancellation and rolls back writes before retry", async () => {
	await seedUser(db, { email: "valid@example.com", password });
	const controller = new AbortController();
	const definition = DATA_MIGRATIONS.legacy_identities;
	if (definition?.kind !== "audit") {
		throw new Error("missing audit");
	}
	const logger = createLogger({ name: "test", level: "silent" });
	logger.info = function abortAfterBatch() {
		controller.abort();
	};
	await expect(
		definition.run({
			client: database.client,
			logger,
			signal: controller.signal,
			report() {},
		}),
	).rejects.toThrow();
	expect(await db.select().from(authAccounts)).toHaveLength(0);
	expect(await db.select().from(users)).toMatchObject([
		{ authMigratedAt: null },
	]);
	expect(await runLegacyIdentities()).toMatchObject({
		status: "passed",
		summary: { credentials: { inserted: 1 } },
	});
});
