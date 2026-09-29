import * as Sentry from "@sentry/node";
import type { Db } from "@virtool/data/db/pg";
import { dataMigrations } from "@virtool/data/db/schema/dataMigrations";
import {
	createTestDatabase,
	type TestDatabase,
} from "@virtool/data/db/test/fixtures";
import { createLogger } from "@virtool/logger";
import {
	afterAll,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	vi,
} from "vitest";

import { defineAudit } from "./define";
import { captureDataMigrationFindings, getDataMigrationReport } from "./report";
import { executeDataMigration } from "./run";

const scope = {
	setTags: vi.fn(),
	setFingerprint: vi.fn(),
	setContext: vi.fn(),
	addAttachment: vi.fn(),
};

vi.mock("@sentry/node", () => ({
	captureException: vi.fn(),
	captureMessage: vi.fn(),
	withScope: vi.fn((callback: (s: typeof scope) => void) => callback(scope)),
}));

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
	await db.delete(dataMigrations);
	vi.clearAllMocks();
});

/** Run an audit that reports two orphans and one duplicate. */
function runDirtyAudit() {
	return executeDataMigration(
		{
			db,
			client: database.client,
			logger: createLogger({ name: "test", level: "silent" }),
			signal: new AbortController().signal,
		},
		defineAudit({
			key: "dirty",
			migrationTag: "0024_fixture",
			kind: "audit",
			version: 2,
			description: "reports three problems",
			run: async ({ report }) => {
				report({ code: "orphan", subject: "user:1" });
				report({ code: "orphan", subject: "user:2" });
				report({ code: "duplicate", subject: "sample:a", detail: { n: 2 } });
			},
		}),
	);
}

describe("getDataMigrationReport", () => {
	it("returns the outcome and every recorded finding", async () => {
		const row = await runDirtyAudit();

		expect(await getDataMigrationReport(db, row)).toMatchObject({
			key: "dirty",
			version: 2,
			kind: "audit",
			status: "failed",
			attempts: 1,
			findings: [
				{ code: "orphan", subject: "user:1" },
				{ code: "orphan", subject: "user:2" },
				{ code: "duplicate", subject: "sample:a", detail: { n: 2 } },
			],
		});
	});
});

describe("captureDataMigrationFindings", () => {
	it("captures one grouped message with the report attached", async () => {
		const report = await getDataMigrationReport(db, await runDirtyAudit());

		captureDataMigrationFindings(report);

		expect(scope.setTags).toHaveBeenCalledWith({
			data_migration: "dirty",
			data_migration_version: 2,
			data_migration_kind: "audit",
		});
		expect(scope.setFingerprint).toHaveBeenCalledWith([
			"data-migration-findings",
			"dirty",
			"2",
		]);
		expect(scope.setContext).toHaveBeenCalledWith(
			"data_migration",
			expect.objectContaining({
				findings: 3,
				findings_by_code: { orphan: 2, duplicate: 1 },
			}),
		);
		expect(scope.addAttachment).toHaveBeenCalledWith({
			filename: "dirty-v2.json",
			data: JSON.stringify(report, null, 2),
			contentType: "application/json",
		});
		expect(Sentry.captureMessage).toHaveBeenCalledWith(
			"data migration dirty@2 did not pass",
			"error",
		);
	});
});
