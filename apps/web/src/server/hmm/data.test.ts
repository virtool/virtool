import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { Db } from "../db/pg";
import {
	HMM_STATUS_ID,
	type HmmUpdate,
	hmms,
	legacyHmmStatus,
} from "../db/schema/hmms";
import { tasks } from "../db/schema/tasks";
import { createTestDatabase, type TestDatabase } from "../db/test/fixtures";
import {
	findHmms,
	getHmm,
	getHmmStatus,
	HMM_INSTALL_TASK_TYPE,
	HmmNotFoundError,
	HmmStatusNotFoundError,
	isInstallInProgress,
} from "./data";

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
	await db.delete(legacyHmmStatus);
	await db.delete(hmms);
	await db.delete(tasks);
});

async function seedHmm(overrides: {
	cluster: number;
	names: string[];
	hidden?: boolean;
}): Promise<number> {
	const [row] = await db
		.insert(hmms)
		.values({
			cluster: overrides.cluster,
			count: 5,
			length: 100,
			mean_entropy: 0.5,
			total_entropy: 50,
			hidden: overrides.hidden ?? false,
			names: overrides.names,
			families: { Papillomaviridae: 3 },
			genera: { Begomovirus: 2 },
			entries: [{ accession: "A.1", gi: "1", name: "one", organism: "virus" }],
		})
		.returning({ id: hmms.id });

	if (!row) {
		throw new Error("failed to seed hmm");
	}

	return row.id;
}

function seedStatus(
	values: {
		errors?: string[];
		updates?: HmmUpdate[];
		installed?: HmmUpdate | null;
		task_id?: number | null;
	} = {},
): Promise<unknown> {
	return db.insert(legacyHmmStatus).values({
		id: HMM_STATUS_ID,
		errors: values.errors ?? [],
		updates: values.updates ?? [],
		installed: values.installed ?? null,
		task_id: values.task_id ?? null,
	});
}

describe("findHmms", () => {
	beforeEach(seedStatus);

	it("returns non-hidden HMMs ordered by cluster then id, with counts", async () => {
		await seedHmm({ cluster: 2, names: ["beta"] });
		await seedHmm({ cluster: 1, names: ["alpha"] });
		await seedHmm({ cluster: 3, names: ["gamma"], hidden: true });

		const result = await findHmms(db, { page: 1, perPage: 25, term: "" });

		expect(result.items.map((doc) => doc.cluster)).toEqual([1, 2]);
		expect(result.totalCount).toBe(2);
		expect(result.foundCount).toBe(2);
		expect(result.pageCount).toBe(1);
	});

	it("matches the search term against any element of the names array", async () => {
		await seedHmm({ cluster: 1, names: ["Influenza A", "Flu"] });
		await seedHmm({ cluster: 2, names: ["Rhinovirus"] });

		const result = await findHmms(db, { page: 1, perPage: 25, term: "flu" });

		expect(result.items).toHaveLength(1);
		expect(result.foundCount).toBe(1);
		expect(result.totalCount).toBe(2);
		expect(result.items[0]?.cluster).toBe(1);
	});

	it("paginates the result set", async () => {
		for (let cluster = 1; cluster <= 3; cluster++) {
			await seedHmm({ cluster, names: [`n${cluster}`] });
		}

		const result = await findHmms(db, { page: 2, perPage: 2, term: "" });

		expect(result.items).toHaveLength(1);
		expect(result.items[0]?.cluster).toBe(3);
		expect(result.page).toBe(2);
		expect(result.pageCount).toBe(2);
	});
});

describe("getHmm", () => {
	beforeEach(seedStatus);

	it("returns the full HMM annotation", async () => {
		const id = await seedHmm({ cluster: 7, names: ["one", "two"] });

		await expect(getHmm(db, id)).resolves.toMatchObject({
			id,
			cluster: 7,
			names: ["one", "two"],
			mean_entropy: 0.5,
			total_entropy: 50,
			length: 100,
		});
	});

	it("throws HmmNotFoundError when the HMM is absent", async () => {
		await expect(getHmm(db, 404_404)).rejects.toThrow(HmmNotFoundError);
	});
});

describe("getHmmStatus", () => {
	it("throws when the status singleton is absent", async () => {
		await expect(getHmmStatus(db)).rejects.toThrow(HmmStatusNotFoundError);
	});

	it("attaches the task referenced by task_id", async () => {
		const [task] = await db
			.insert(tasks)
			.values({
				complete: false,
				context: {},
				count: 0,
				created_at: new Date(),
				progress: 42,
				step: "download",
				type: HMM_INSTALL_TASK_TYPE,
			})
			.returning({ id: tasks.id });
		if (!task) {
			throw new Error("failed to seed task");
		}

		await seedStatus({ task_id: task.id });

		const status = await getHmmStatus(db);

		expect(status.task).toMatchObject({
			id: task.id,
			progress: 42,
			step: "download",
		});
	});

	it("normalizes installed to its ready flag", async () => {
		await seedStatus({
			installed: { ready: true } as HmmUpdate,
		});

		const status = await getHmmStatus(db);

		expect(status.installed).toEqual({ ready: true });
		expect(status.task).toBeNull();
	});
});

describe("isInstallInProgress", () => {
	it("is true when an update has not finished installing", async () => {
		await seedStatus({ updates: [{ ready: false } as HmmUpdate] });
		await expect(isInstallInProgress(db)).resolves.toBe(true);
	});

	it("is false when every update is ready", async () => {
		await seedStatus({ updates: [{ ready: true } as HmmUpdate] });
		await expect(isInstallInProgress(db)).resolves.toBe(false);
	});
});
