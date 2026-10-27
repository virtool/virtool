import { eq } from "drizzle-orm";
import { beforeEach, expect, it } from "vitest";
import type { Db } from "../db/pg";
import { users } from "../db/schema/users";
import { createTestDatabase, type TestDatabase } from "../db/test/fixtures";
import { getEmailRemediationReport } from "./remediation";
import { seedUser } from "./test/fixtures";

let database: TestDatabase;
let db: Db;

beforeEach(async () => {
	database ??= await createTestDatabase();
	db = database.db;
	await db.delete(users);
}, 60_000);

it("counts active and deactivated unmigrated accounts", async () => {
	const migrated = await seedUser(db, { handle: "migrated" });
	await db
		.update(users)
		.set({ authMigratedAt: new Date() })
		.where(eq(users.id, migrated));
	await seedUser(db, { handle: "active-legacy" });
	await seedUser(db, { active: false, handle: "inactive-legacy" });
	await seedUser(db, { handle: "pending", lifecycleState: "pending" });

	const report = await getEmailRemediationReport(db);

	expect(report.activeUnmigrated).toBe(1);
	expect(report.deactivatedUnmigrated).toBe(1);
});
