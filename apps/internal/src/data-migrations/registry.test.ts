import {
	type SeedUserOptions,
	seedUser,
} from "@virtool/data/auth/test/fixtures";
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
// The legacy_identities body accepts only bcrypt hashes.
const password = Buffer.from(
	"$2b$04$kPtBmOaneedB2BF3Cb.K1.UE9NXs7YH1VPE4aZKaUXEpuj7ze8.JK",
	"utf8",
);

beforeAll(async () => {
	database = await createTestDatabase();
	db = database.db;
	// The body runs against the schema of its paired migration, where every user
	// has a handle and an unmigrated user has no username yet.
	await database.client`
		ALTER TABLE public.users
		DROP CONSTRAINT username_matches_lifecycle_state
	`;
}, 60_000);

afterAll(async () => {
	await database.drop();
});

beforeEach(async () => {
	await db.delete(dataMigrations);
	await db.delete(users);
});

let seeded = 0;

async function seedLegacyUser({
	handle = "alice",
	...options
}: Omit<SeedUserOptions, "username"> & { handle?: string }): Promise<number> {
	seeded += 1;
	const id = await seedUser(db, { ...options, username: `seed${seeded}` });
	await database.client`
		UPDATE public.users SET handle = ${handle}, username = NULL WHERE id = ${id}
	`;
	return id;
}

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
	const eligible = await seedLegacyUser({
		handle: "Ada",
		email: " Ada@Example.com ",
		password,
	});
	const incomplete = await seedLegacyUser({
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
	const userId = await seedLegacyUser({
		handle: "not valid",
		email: "invalid-handle@example.com",
		password,
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
	const id = await seedLegacyUser({
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
		const id = await seedLegacyUser({ handle: "not valid", email, password });
		if (email.includes("@")) {
			await seedLegacyUser({
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
		await seedLegacyUser({ handle, email, password });
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
		const id = await seedLegacyUser({ handle: "owner", password });
		if (state === "missing" || state === "null") {
			await db
				.update(users)
				.set({ authMigratedAt: new Date() })
				.where(eq(users.id, id));
		}
		if (state !== "missing") {
			const owner =
				state === "foreign"
					? await seedLegacyUser({ handle: "other", password })
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

it("blocks a user linked to separate credentials by owner and account id", async () => {
	const id = await seedLegacyUser({ handle: "owner", password });
	const other = await seedLegacyUser({ handle: "other", password });
	await db
		.update(users)
		.set({ authMigratedAt: new Date() })
		.where(eq(users.id, id));
	for (const [accountId, userId] of [
		[String(id), other],
		["extra", id],
	] as const) {
		await db.insert(authAccounts).values({
			accountId,
			providerId: "credential",
			userId,
			password: password.toString("utf8"),
			createdAt: new Date(),
			updatedAt: new Date(),
		});
	}
	const accounts = await db.select().from(authAccounts);
	const finished = await runLegacyIdentities();
	expect(finished.status).toBe("failed");
	expect(await listDataMigrationFindings(db, finished.id)).toEqual(
		expect.arrayContaining([
			expect.objectContaining({
				code: "credential_conflict",
				subject: `user:${id}`,
			}),
			expect.objectContaining({
				code: "credential_conflict",
				subject: `user:${other}`,
			}),
		]),
	);
	expect(await db.select().from(authAccounts)).toEqual(accounts);
});

it("repairs stale credentials and rejects invalid legacy passwords on migrated users", async () => {
	const id = await seedLegacyUser({ email: "valid@example.com", password });
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

it("observes cancellation before starting the migration", async () => {
	await seedLegacyUser({ email: "valid@example.com", password });
	const controller = new AbortController();
	controller.abort();
	const definition = DATA_MIGRATIONS.legacy_identities;
	if (definition?.kind !== "audit") {
		throw new Error("missing audit");
	}
	await expect(
		definition.run({
			client: database.client,
			logger: createLogger({ name: "test", level: "silent" }),
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
