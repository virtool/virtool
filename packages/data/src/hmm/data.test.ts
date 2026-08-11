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
	fetchAndUpdateRelease,
	findHmms,
	getHmm,
	getHmmStatus,
	HMM_INSTALL_TASK_TYPE,
	HmmNotFoundError,
	HmmReleaseError,
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
			meanEntropy: 0.5,
			totalEntropy: 50,
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

describe("fetchAndUpdateRelease", () => {
	const manifestRelease = {
		body: "notes",
		content_type: "application/gzip",
		download_url: "https://www.virtool.ca/hmm.tar.gz",
		filename: "hmm.tar.gz",
		html_url: "https://github.com/virtool/virtool-hmm/releases/v2.0.0",
		id: 45,
		name: "v2.0.0",
		published_at: "2026-01-01T00:00:00Z",
		size: 1024,
	};

	/** Answer the manifest fetch with `body` under `status`. */
	function stubFetch(status: number, body: unknown): void {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => new Response(JSON.stringify(body), { status })),
		);
	}

	/**
	 * Answer nothing until the request's signal aborts.
	 *
	 * The already-aborted check is not redundant: `addEventListener("abort")`
	 * never fires on a signal that aborted before it was attached, and a stub
	 * without it hangs for whatever `AbortSignal.any` was handed.
	 */
	function stubHangingFetch(): void {
		vi.stubGlobal(
			"fetch",
			vi.fn(
				(_url: string, init?: { signal?: AbortSignal }) =>
					new Promise<Response>((_resolve, reject) => {
						const signal = init?.signal;

						if (signal?.aborted) {
							reject(signal.reason);
							return;
						}

						signal?.addEventListener("abort", () => {
							reject(signal.reason);
						});
					}),
			),
		);
	}

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("stores the newest manifest entry and stamps retrieved_at", async () => {
		await seedStatus();
		stubFetch(200, { "virtool-hmm": [manifestRelease] });

		const release = await fetchAndUpdateRelease(db);

		expect(release).toMatchObject({ id: 45, name: "v2.0.0", newer: true });
		expect(release?.retrieved_at).not.toBe("");

		const [row] = await db.select().from(legacyHmmStatus);

		expect(row?.release).toEqual(release);
		expect(row?.errors).toEqual([]);
	});

	it("creates the status row when there is none", async () => {
		stubFetch(200, { "virtool-hmm": [manifestRelease] });

		await expect(fetchAndUpdateRelease(db)).resolves.toMatchObject({ id: 45 });

		const rows = await db.select().from(legacyHmmStatus);

		expect(rows).toHaveLength(1);
	});

	// A manifest naming no release and a status row holding none leaves nothing to
	// stamp `retrieved_at` on. Reading through the absent release rather than
	// returning early is a `TypeError` that fails the refresh task.
	it("returns null when the manifest and the status row both name no release", async () => {
		await seedStatus();
		stubFetch(200, { "virtool-hmm": [] });

		await expect(fetchAndUpdateRelease(db)).resolves.toBeNull();

		const [row] = await db.select().from(legacyHmmStatus);

		expect(row?.release).toBeNull();
		expect(row?.errors).toEqual([]);
	});

	it("keeps the stored release when the manifest names none", async () => {
		await seedStatus();
		stubFetch(200, { "virtool-hmm": [manifestRelease] });
		await fetchAndUpdateRelease(db);

		stubFetch(200, {});

		await expect(fetchAndUpdateRelease(db)).resolves.toMatchObject({ id: 45 });
	});

	it("records the error and rethrows when virtool.ca cannot be reached", async () => {
		await seedStatus();
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => {
				throw new TypeError("fetch failed");
			}),
		);

		await expect(fetchAndUpdateRelease(db)).rejects.toBeInstanceOf(
			HmmReleaseError,
		);

		const [row] = await db.select().from(legacyHmmStatus);

		expect(row?.errors).toEqual(["Could not reach Virtool.ca"]);
	});

	it("records the error and rethrows when the manifest is missing", async () => {
		await seedStatus();
		stubFetch(404, {});

		await expect(fetchAndUpdateRelease(db)).rejects.toBeInstanceOf(
			HmmReleaseError,
		);

		const [row] = await db.select().from(legacyHmmStatus);

		expect(row?.errors).toEqual(["Release does not exist"]);
	});

	// A 503 reported as a release that does not exist sends whoever reads the HMM
	// page looking for a release that is in fact sitting there.
	it("distinguishes a refusal by virtool.ca from a missing manifest", async () => {
		await seedStatus();
		stubFetch(503, {});

		await expect(fetchAndUpdateRelease(db)).rejects.toBeInstanceOf(
			HmmReleaseError,
		);

		const [row] = await db.select().from(legacyHmmStatus);

		expect(row?.errors).toEqual(["Virtool.ca answered 503"]);
	});

	it("rethrows the caller's abort without recording an error", async () => {
		await seedStatus({ errors: [] });

		const controller = new AbortController();

		stubHangingFetch();

		const refresh = fetchAndUpdateRelease(db, controller.signal);

		controller.abort();

		// Not an `HmmReleaseError`: the process is going away, and the release is
		// neither stale nor unreachable.
		await expect(refresh).rejects.not.toBeInstanceOf(HmmReleaseError);

		const [row] = await db.select().from(legacyHmmStatus);

		expect(row?.errors).toEqual([]);
	});

	// The deadline itself is not waited out — ten seconds of wall clock buys
	// nothing over proving the signal is attached and that firing it is reported
	// as an unreachable host rather than escaping as a raw `AbortError`.
	it("abandons a fetch that never answers", async () => {
		await seedStatus();

		let signal: AbortSignal | undefined;

		vi.stubGlobal(
			"fetch",
			vi.fn(async (_url: string, init?: { signal?: AbortSignal }) => {
				signal = init?.signal;

				throw new DOMException("aborted due to timeout", "TimeoutError");
			}),
		);

		await expect(fetchAndUpdateRelease(db)).rejects.toBeInstanceOf(
			HmmReleaseError,
		);

		expect(signal).toBeInstanceOf(AbortSignal);

		const [row] = await db.select().from(legacyHmmStatus);

		expect(row?.errors).toEqual(["Could not reach Virtool.ca"]);
	});
});
