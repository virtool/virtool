import { Readable } from "node:stream";
import { setTimeout as delay } from "node:timers/promises";
import { gunzipSync } from "node:zlib";
import type { HmmAnnotation, HmmAnnotationRecord } from "@virtool/contracts";
import {
	HMM_ANNOTATIONS_KEY,
	HMM_PROFILES_KEY,
	MemoryStorage,
} from "@virtool/storage";
import { eq } from "drizzle-orm";
import {
	afterAll,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	onTestFinished,
	vi,
} from "vitest";
import type { Db } from "../db/pg";
import {
	HMM_STATUS_ID,
	type HmmRelease,
	type HmmUpdate,
	hmms,
	legacyHmmStatus,
} from "../db/schema/hmms";
import { tasks } from "../db/schema/tasks";
import { createTestDatabase, type TestDatabase } from "../db/test/fixtures";
import { testLogger } from "../test/logger";
import {
	cleanHmmStatus,
	installHmms,
	isInstallInProgress,
	writeHmmAnnotations,
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

const RELEASE_ID = 4321;

function createRelease(overrides: Partial<HmmRelease> = {}): HmmRelease {
	return {
		body: "notes",
		content_type: "application/gzip",
		download_url: "https://www.virtool.ca/releases/hmm.tar.gz",
		filename: "hmm.tar.gz",
		html_url: "https://github.com/virtool/virtool-hmm/releases/v0.2.1",
		id: RELEASE_ID,
		name: "v0.2.1",
		newer: true,
		published_at: "2026-01-02T00:00:00Z",
		retrieved_at: "2026-01-03T00:00:00Z",
		size: 1024,
		...overrides,
	};
}

function createAnnotation(cluster: number): HmmAnnotation {
	return {
		cluster,
		count: 3,
		entries: [
			{ accession: `NP_${cluster}`, gi: "12345", name: "cap", organism: "vir" },
		],
		families: { Papillomaviridae: 2 },
		genera: { Alphapapillomavirus: 2 },
		length: 100 + cluster,
		mean_entropy: 0.5,
		names: [`protein ${cluster}`],
		total_entropy: 50.5,
	};
}

/** Seed the status singleton with a pending update for `releaseId`. */
async function seedPendingStatus(releaseId: number | string = RELEASE_ID) {
	const update = {
		body: "notes",
		created_at: "2026-01-03T00:00:00Z",
		filename: "hmm.tar.gz",
		html_url: "https://github.com/virtool/virtool-hmm/releases/v0.2.1",
		id: releaseId,
		name: "v0.2.1",
		newer: true,
		published_at: "2026-01-02T00:00:00Z",
		ready: false,
		size: 1024,
		user: { id: 1 },
	} as unknown as HmmUpdate;

	await db.insert(legacyHmmStatus).values({
		id: HMM_STATUS_ID,
		errors: [],
		installed: null,
		release: createRelease(),
		task_id: null,
		updates: [update],
	});
}

async function readStatus() {
	const [row] = await db
		.select()
		.from(legacyHmmStatus)
		.where(eq(legacyHmmStatus.id, HMM_STATUS_ID));

	return row;
}

function profilesOf(body: string) {
	return () => Readable.from([Buffer.from(body)]);
}

async function readKey(storage: MemoryStorage, key: string): Promise<Buffer> {
	const parts: Uint8Array[] = [];

	for await (const part of storage.read(key)) {
		parts.push(part);
	}

	return Buffer.concat(parts);
}

async function listKeys(storage: MemoryStorage): Promise<string[]> {
	const keys: string[] = [];

	for await (const object of storage.list("")) {
		keys.push(object.key);
	}

	return keys.sort();
}

describe("installHmms", () => {
	it("inserts a row per annotation, records the install, and writes the profiles", async () => {
		const storage = new MemoryStorage();
		await seedPendingStatus();

		const performed = await installHmms(db, storage, testLogger, {
			annotations: [createAnnotation(1), createAnnotation(2)],
			profiles: profilesOf("HMMER3/f profiles"),
			release: createRelease(),
			userId: 1,
		});

		expect(performed).toBe(true);

		const rows = await db.select().from(hmms);
		expect(rows).toHaveLength(2);
		expect(rows.map((row) => row.cluster).sort()).toEqual([1, 2]);
		// Python passes `hidden=False` explicitly rather than leaning on a default.
		expect(rows.every((row) => row.hidden === false)).toBe(true);

		const status = await readStatus();
		expect(status?.installed?.ready).toBe(true);
		expect(status?.updates[0]?.ready).toBe(true);

		expect(await readKey(storage, HMM_PROFILES_KEY)).toEqual(
			Buffer.from("HMMER3/f profiles"),
		);
	});

	/*
	 * The wedge this whole task exists to close. Nothing in the repo set
	 * `ready: true` before it, so the first install left `isInstallInProgress`
	 * permanently on and every install after it was refused.
	 */
	it("leaves no install in progress, so another can be started", async () => {
		const storage = new MemoryStorage();
		await seedPendingStatus();

		expect(await isInstallInProgress(db)).toBe(true);

		await installHmms(db, storage, testLogger, {
			annotations: [createAnnotation(1)],
			profiles: profilesOf("profiles"),
			release: createRelease(),
			userId: 1,
		});

		expect(await isInstallInProgress(db)).toBe(false);
	});

	it("flips only the entry matching the release", async () => {
		const storage = new MemoryStorage();
		await seedPendingStatus();

		const status = await readStatus();

		await db
			.update(legacyHmmStatus)
			.set({
				updates: [
					{ ...(status?.updates[0] as HmmUpdate), id: 999, ready: false },
					status?.updates[0] as HmmUpdate,
				],
			})
			.where(eq(legacyHmmStatus.id, HMM_STATUS_ID));

		await installHmms(db, storage, testLogger, {
			annotations: [createAnnotation(1)],
			profiles: profilesOf("profiles"),
			release: createRelease(),
			userId: 1,
		});

		const after = await readStatus();
		expect(after?.updates[0]?.ready).toBe(false);
		expect(after?.updates[1]?.ready).toBe(true);
	});

	/*
	 * `HmmRelease.id` is typed `number`, but an entry migrated out of Mongo can
	 * carry it as a string. Python guards the same comparison with an
	 * `int()`-and-`except TypeError`; failing it here is silent — every row and
	 * byte is written and `ready` is never flipped.
	 */
	it("matches an update whose id was stored as a string", async () => {
		const storage = new MemoryStorage();
		await seedPendingStatus(String(RELEASE_ID));

		await installHmms(db, storage, testLogger, {
			annotations: [createAnnotation(1)],
			profiles: profilesOf("profiles"),
			release: createRelease(),
			userId: 1,
		});

		expect((await readStatus())?.updates[0]?.ready).toBe(true);
	});

	it("writes rows and profiles but records nothing when no entry matches", async () => {
		const storage = new MemoryStorage();
		await seedPendingStatus(11);

		await installHmms(db, storage, testLogger, {
			annotations: [createAnnotation(1)],
			profiles: profilesOf("profiles"),
			release: createRelease(),
			userId: 1,
		});

		const status = await readStatus();
		expect(status?.installed).toBeNull();
		expect(status?.updates[0]?.ready).toBe(false);
		expect(await db.select().from(hmms)).toHaveLength(1);
	});

	it("deletes the profiles it wrote when the transaction fails after the write", async () => {
		const storage = new MemoryStorage();
		await seedPendingStatus();

		// Fails after `storage.write` has run and before the commit lands.
		const write = vi
			.spyOn(storage, "write")
			.mockImplementation(async (key, data) => {
				const backend = MemoryStorage.prototype.write.bind(storage);
				const written = await backend(key, data);
				throw Object.assign(new Error("commit exploded"), { written });
			});

		await expect(
			installHmms(db, storage, testLogger, {
				annotations: [createAnnotation(1)],
				profiles: profilesOf("profiles"),
				release: createRelease(),
				userId: 1,
			}),
		).rejects.toThrow("commit exploded");

		write.mockRestore();

		expect(await listKeys(storage)).not.toContain(HMM_PROFILES_KEY);
		expect(await db.select().from(hmms)).toHaveLength(0);
	});

	/*
	 * The `wroteProfiles` gate. A failure *before* the write must not delete the
	 * previous install's profiles, which are the only copy the server has.
	 * Without this test a refactor hoisting the delete out of the flag passes.
	 */
	it("leaves a prior install's profiles alone when it fails before writing", async () => {
		const storage = new MemoryStorage();
		await seedPendingStatus();

		await storage.write(
			HMM_PROFILES_KEY,
			Readable.from([Buffer.from("older")]),
		);

		const insert = vi.spyOn(db, "transaction").mockImplementation(async () => {
			throw new Error("insert exploded");
		});

		await expect(
			installHmms(db, storage, testLogger, {
				annotations: [createAnnotation(1)],
				profiles: profilesOf("newer"),
				release: createRelease(),
				userId: 1,
			}),
		).rejects.toThrow("insert exploded");

		insert.mockRestore();

		expect(await readKey(storage, HMM_PROFILES_KEY)).toEqual(
			Buffer.from("older"),
		);
	});

	it("completes with an empty annotations array", async () => {
		const storage = new MemoryStorage();
		await seedPendingStatus();

		await expect(
			installHmms(db, storage, testLogger, {
				annotations: [],
				profiles: profilesOf("profiles"),
				release: createRelease({ size: 0 }),
				userId: 1,
			}),
		).resolves.toBe(true);

		expect(await db.select().from(hmms)).toHaveLength(0);
		expect((await readStatus())?.updates[0]?.ready).toBe(true);
	});

	it("does not insert a second time when the release is already installed", async () => {
		const storage = new MemoryStorage();
		await seedPendingStatus();

		const values = {
			annotations: [createAnnotation(1), createAnnotation(2)],
			profiles: profilesOf("profiles"),
			release: createRelease(),
			userId: 1,
		};

		expect(await installHmms(db, storage, testLogger, values)).toBe(true);
		expect(await db.select().from(hmms)).toHaveLength(2);

		// The reclaim: the same task row runs again from step zero.
		expect(await installHmms(db, storage, testLogger, values)).toBe(false);
		expect(await db.select().from(hmms)).toHaveLength(2);
	});

	/*
	 * Two runners on one release, which a reclaim can produce while the first is
	 * still inserting. The status read is the whole of the idempotency guard, so
	 * unlocked both would see `ready: false` and write a full set of rows each.
	 */
	it("serializes a concurrent install of the same release", async () => {
		const storage = new MemoryStorage();
		await seedPendingStatus();

		const second = database.connect();
		onTestFinished(() => second.close());

		const values = {
			annotations: [createAnnotation(1), createAnnotation(2)],
			profiles: profilesOf("profiles"),
			release: createRelease(),
			userId: 1,
		};

		let concurrent: Promise<boolean> | undefined;

		// Started from inside the first transaction, after its inserts, and given
		// long enough to reach the locked row.
		const performed = await installHmms(
			db,
			storage,
			testLogger,
			values,
			async () => {
				concurrent ??= installHmms(second.db, storage, testLogger, values);
				await delay(250);
			},
		);

		expect(performed).toBe(true);
		expect(await concurrent).toBe(false);
		expect(await db.select().from(hmms)).toHaveLength(2);
	});

	it("reports progress over the annotation count", async () => {
		const storage = new MemoryStorage();
		await seedPendingStatus();

		const reported: number[] = [];

		await installHmms(
			db,
			storage,
			testLogger,
			{
				annotations: [1, 2, 3].map(createAnnotation),
				profiles: profilesOf("profiles"),
				release: createRelease(),
				userId: 1,
			},
			async (percent) => {
				reported.push(percent);
			},
		);

		expect(reported).toEqual([100]);
	});

	it("writes the annotations blob after committing", async () => {
		const storage = new MemoryStorage();
		await seedPendingStatus();

		await installHmms(db, storage, testLogger, {
			annotations: [createAnnotation(7), createAnnotation(9)],
			profiles: profilesOf("profiles"),
			release: createRelease(),
			userId: 1,
		});

		const records = JSON.parse(
			gunzipSync(await readKey(storage, HMM_ANNOTATIONS_KEY)).toString(),
		) as HmmAnnotationRecord[];

		expect(records).toHaveLength(2);
		expect(records.map((record) => record.cluster)).toEqual([7, 9]);
		// The id NuVs maps each vFam cluster onto, assigned by Postgres.
		expect(records.every((record) => typeof record.id === "number")).toBe(true);
	});

	it("rewrites the annotations blob on a re-run that short-circuits", async () => {
		const storage = new MemoryStorage();
		await seedPendingStatus();

		const values = {
			annotations: [createAnnotation(7)],
			profiles: profilesOf("profiles"),
			release: createRelease(),
			userId: 1,
		};

		await installHmms(db, storage, testLogger, values);
		await storage.delete(HMM_ANNOTATIONS_KEY);

		expect(await installHmms(db, storage, testLogger, values)).toBe(false);
		expect(await listKeys(storage)).toContain(HMM_ANNOTATIONS_KEY);
	});

	// Nothing else writes this key, so a swallowed failure would report a
	// successful install and leave NuVs with a blob nothing can recreate.
	it("fails when the annotations blob cannot be written", async () => {
		const storage = new MemoryStorage();
		await seedPendingStatus();

		let call = 0;
		const write = vi.spyOn(storage, "write").mockImplementation(async function (
			this: MemoryStorage,
			key,
			data,
		) {
			call += 1;
			if (call > 1) {
				throw new Error("bucket exploded");
			}
			return MemoryStorage.prototype.write.call(storage, key, data);
		});

		await expect(
			installHmms(db, storage, testLogger, {
				annotations: [createAnnotation(1)],
				profiles: profilesOf("profiles"),
				release: createRelease(),
				userId: 1,
			}),
		).rejects.toThrow("bucket exploded");

		write.mockRestore();

		// The rows and profiles committed before the blob was attempted, so the
		// failure does not roll them back — only the partial blob is dropped.
		expect(await db.select().from(hmms)).toHaveLength(1);
		expect(await listKeys(storage)).not.toContain(HMM_ANNOTATIONS_KEY);
	});
});

describe("writeHmmAnnotations", () => {
	it("writes an empty array when nothing is installed", async () => {
		const storage = new MemoryStorage();

		await writeHmmAnnotations(db, storage);

		expect(
			gunzipSync(await readKey(storage, HMM_ANNOTATIONS_KEY)).toString(),
		).toBe("[]");
	});

	it("orders records by id and pages past the batch size", async () => {
		const storage = new MemoryStorage();

		await db.insert(hmms).values(
			Array.from({ length: 750 }, (_, index) => ({
				...createAnnotation(index),
				hidden: false,
			})),
		);

		await writeHmmAnnotations(db, storage);

		const records = JSON.parse(
			gunzipSync(await readKey(storage, HMM_ANNOTATIONS_KEY)).toString(),
		) as HmmAnnotationRecord[];

		expect(records).toHaveLength(750);
		expect(records.map((record) => record.id)).toEqual(
			[...records].map((record) => record.id).sort((a, b) => a - b),
		);
	});
});

describe("cleanHmmStatus", () => {
	it("clears the install record", async () => {
		await seedPendingStatus();

		await db
			.update(legacyHmmStatus)
			.set({ installed: { ready: true } as unknown as HmmUpdate })
			.where(eq(legacyHmmStatus.id, HMM_STATUS_ID));

		await cleanHmmStatus(db);

		const status = await readStatus();

		expect(status?.installed).toBeNull();
		expect(status?.task_id).toBeNull();
		expect(status?.updates).toEqual([]);
		// The release itself survives, so the install button still has one to offer.
		expect(status?.release?.id).toBe(RELEASE_ID);
	});
});
