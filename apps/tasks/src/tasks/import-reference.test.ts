import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { seedUser } from "@virtool/data/auth/test/fixtures";
import type { Db } from "@virtool/data/db/pg";
import {
	legacyHistory,
	legacyHistoryDiff,
} from "@virtool/data/db/schema/history";
import { legacyOtus, legacySequences } from "@virtool/data/db/schema/otus";
import {
	legacyReferences,
	legacyReferenceUsers,
} from "@virtool/data/db/schema/references";
import { tasks } from "@virtool/data/db/schema/tasks";
import { uploads } from "@virtool/data/db/schema/uploads";
import { users } from "@virtool/data/db/schema/users";
import {
	createTestDatabase,
	type TestDatabase,
} from "@virtool/data/db/test/fixtures";
import type { ClaimedTask } from "@virtool/data/tasks/data";
import { createLogger, type Logger } from "@virtool/logger";
import { createIndexArtifact } from "@virtool/sqlite";
import { MemoryStorage } from "@virtool/storage";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { runTask } from "../framework/run";
import { acquireOrThrow, readTaskRow, seedTaskRow } from "../testing/tasks";
import { importReferenceTask } from "./import-reference";
import type { TaskContext } from "./registry";

const logger: Logger = createLogger({ name: "test", level: "silent" });

const NAME_ON_DISK = "8f3c-reference.json.gz";

const STORAGE_KEY = "uploads/deadbeef";

let database: TestDatabase;
let db: Db;
let storage: MemoryStorage;
let ctx: TaskContext;
let userId: number;
let referenceId: number;

beforeAll(async () => {
	database = await createTestDatabase();
	db = database.db;
}, 60_000);

afterAll(async () => {
	await database.drop();
});

beforeEach(async () => {
	await db.delete(legacyHistoryDiff);
	await db.delete(legacyHistory);
	await db.delete(legacySequences);
	await db.delete(legacyOtus);
	await db.delete(legacyReferenceUsers);
	await db.delete(legacyReferences);
	await db.delete(tasks);
	await db.delete(uploads);
	await db.delete(users);

	storage = new MemoryStorage();
	ctx = { db, storage };

	userId = await seedUser(db, { handle: "curator" });
	referenceId = await seedReference(userId);
});

async function seedReference(owner: number): Promise<number> {
	const [row] = await db
		.insert(legacyReferences)
		.values({
			name: "Imported",
			description: "",
			organism: "",
			created_at: new Date("2021-06-01T00:00:00.000Z"),
			archived: false,
			restrict_source_types: false,
			source_types: [],
			user_id: owner,
		})
		.returning({ id: legacyReferences.id });

	if (row === undefined) {
		throw new Error("failed to seed a reference");
	}

	return row.id;
}

async function seedUpload(nameOnDisk: string): Promise<void> {
	await db.insert(uploads).values({
		name: "reference.json.gz",
		nameOnDisk,
		ready: true,
		removed: false,
		reserved: false,
		storageKey: STORAGE_KEY,
		type: "reference",
		userId,
	});
}

async function* once(bytes: Uint8Array): AsyncIterable<Uint8Array> {
	yield bytes;
}

function sourceOtu(overrides: Record<string, unknown> = {}) {
	return {
		_id: "otu_source",
		abbreviation: "ABTV",
		name: "Abaca bunchy top virus",
		isolates: [
			{
				id: "iso_a",
				default: true,
				source_type: "isolate",
				source_name: "A1",
				sequences: [
					{
						_id: "seq_a1",
						accession: "NC_010315",
						definition: "Abaca bunchy top virus DNA A",
						sequence: "CCCCAAAATT",
					},
				],
			},
		],
		...overrides,
	};
}

function sourceData(otus: unknown[] = [sourceOtu()]) {
	return { data_type: "genome", organism: "virus", otus };
}

async function seedGzippedUpload(
	data: unknown,
	nameOnDisk = NAME_ON_DISK,
): Promise<void> {
	await seedUpload(nameOnDisk);
	await storage.write(
		STORAGE_KEY,
		once(gzipSync(Buffer.from(JSON.stringify(data), "utf8"))),
	);
}

async function claim(nameOnDisk = NAME_ON_DISK): Promise<ClaimedTask> {
	await seedTaskRow(db, importReferenceTask.type, {
		name_on_disk: nameOnDisk,
		ref_id: referenceId,
		user_id: userId,
	});

	return acquireOrThrow(db, importReferenceTask.type);
}

function run(task: ClaimedTask, signal = new AbortController().signal) {
	return runTask({ db, def: importReferenceTask, task, ctx, logger, signal });
}

describe("import_reference", () => {
	it("imports a gzipped JSON reference", async () => {
		await seedGzippedUpload(sourceData());

		const task = await claim();

		expect(await run(task)).toEqual({ status: "completed" });

		expect(await readTaskRow(db, task.id)).toMatchObject({
			complete: true,
			error: null,
			progress: 100,
			step: "import_reference",
		});

		const otuRows = await db
			.select()
			.from(legacyOtus)
			.where(eq(legacyOtus.reference_id, referenceId));

		expect(otuRows).toHaveLength(1);

		const otu = otuRows[0];

		expect(otu?.name).toBe("Abaca bunchy top virus");
		expect(otu?.version).toBe(0);

		// A fresh id is minted and the source id is kept on `remote`, so a
		// re-import never collides with what a previous one wrote.
		expect(otu?.id).not.toBe("otu_source");
		expect(otu?.data).toMatchObject({
			imported: true,
			remote: { id: "otu_source" },
			version: 0,
		});
	});

	it("updates the reference's organism from the file", async () => {
		await seedGzippedUpload(sourceData());

		expect(await run(await claim())).toEqual({ status: "completed" });

		const [row] = await db
			.select({ organism: legacyReferences.organism })
			.from(legacyReferences)
			.where(eq(legacyReferences.id, referenceId));

		expect(row?.organism).toBe("virus");
	});

	it("records one creating history row per OTU", async () => {
		await seedGzippedUpload(sourceData());

		expect(await run(await claim())).toEqual({ status: "completed" });

		const rows = await db
			.select()
			.from(legacyHistory)
			.where(eq(legacyHistory.reference_id, referenceId));

		expect(rows).toHaveLength(1);
		expect(rows[0]).toMatchObject({
			description: "Imported Abaca bunchy top virus (ABTV)",
			method_name: "import",
			otu_version: "0",
		});
	});

	it("lifts sequences out of their isolates", async () => {
		await seedGzippedUpload(sourceData());

		expect(await run(await claim())).toEqual({ status: "completed" });

		const sequences = await db.select().from(legacySequences);

		expect(sequences).toHaveLength(1);
		expect(sequences[0]?.position).toBe(0);

		const [otu] = await db.select().from(legacyOtus);

		if (otu === undefined) {
			throw new Error("the import wrote no OTU");
		}

		const { isolates } = otu.data as {
			isolates: Record<string, unknown>[];
		};

		expect(isolates[0]).not.toHaveProperty("sequences");
	});

	it("is idempotent across a re-run", async () => {
		await seedGzippedUpload(sourceData());

		expect(await run(await claim())).toEqual({ status: "completed" });

		await db.delete(tasks);

		expect(await run(await claim())).toEqual({ status: "completed" });

		expect(await db.select().from(legacyOtus)).toHaveLength(1);
		expect(await db.select().from(legacySequences)).toHaveLength(1);
		expect(await db.select().from(legacyHistory)).toHaveLength(1);
	});

	it("fails without reading storage when the upload is gone", async () => {
		const task = await claim();

		expect(await run(task)).toMatchObject({
			status: "failed",
			error: expect.stringContaining("could not be found"),
		});
	});

	it("reports a file that is not gzipped the way Python does", async () => {
		await seedUpload(NAME_ON_DISK);
		await storage.write(STORAGE_KEY, once(Buffer.from("not gzip at all")));

		expect(await run(await claim())).toMatchObject({
			status: "failed",
			error: expect.stringContaining("Not a gzipped file"),
		});
	});

	it("refuses a suffix neither reader understands", async () => {
		await seedGzippedUpload(sourceData(), "reference.tar.gz");

		expect(await run(await claim("reference.tar.gz"))).toMatchObject({
			status: "failed",
			error: expect.stringContaining("Unsupported reference file name"),
		});
	});

	it("names the duplicated ids when a file repeats an OTU id", async () => {
		await seedGzippedUpload(
			sourceData([
				sourceOtu(),
				sourceOtu({
					name: "Another virus",
					isolates: sourceOtu({}).isolates.map((isolate) => ({
						...isolate,
						id: "iso_b",
						sequences: [
							{
								_id: "seq_b1",
								accession: "NC_000002",
								definition: "Another",
								sequence: "TTTTGGGGCC",
							},
						],
					})),
				}),
			]),
		);

		expect(await run(await claim())).toMatchObject({
			status: "failed",
			error: expect.stringContaining("Duplicate OTU ids"),
		});
	});

	it("rejects a sequence shorter than ten bases", async () => {
		await seedGzippedUpload(
			sourceData([
				sourceOtu({
					isolates: [
						{
							id: "iso_a",
							default: true,
							source_type: "isolate",
							source_name: "A1",
							sequences: [
								{
									_id: "seq_a1",
									accession: "NC_010315",
									definition: "Too short",
									sequence: "ACGT",
								},
							],
						},
					],
				}),
			]),
		);

		expect(await run(await claim())).toMatchObject({
			status: "failed",
			error: expect.stringContaining("Invalid reference data"),
		});
	});

	it("leaves the reference in place when the file is unusable", async () => {
		await seedUpload(NAME_ON_DISK);
		await storage.write(STORAGE_KEY, once(Buffer.from("not gzip at all")));

		expect(await run(await claim())).toMatchObject({ status: "failed" });

		expect(
			await db
				.select()
				.from(legacyReferences)
				.where(eq(legacyReferences.id, referenceId)),
		).toHaveLength(1);
	});

	it("imports a .v1.sqlite snapshot", async () => {
		const nameOnDisk = "8f3c-reference.v1.sqlite";
		const workPath = await mkdtemp(join(tmpdir(), "vt-import-test-"));
		const path = join(workPath, "snapshot.v1.sqlite");

		try {
			await createIndexArtifact(
				path,
				{
					created_at: "2021-06-01T00:00:00.000Z",
					data_type: "genome",
					id: "reference_1",
					name: "Plant Viruses",
					organism: "virus",
				},
				[
					{
						abbreviation: "ABTV",
						id: "otu_source",
						isolates: [
							{
								default: true,
								id: "iso_a",
								sequences: [
									{
										accession: "NC_010315",
										definition: "Abaca bunchy top virus DNA A",
										host: null,
										id: "seq_a1",
										segment: null,
										sequence: "CCCCAAAATT",
									},
								],
								source_name: "A1",
								source_type: "isolate",
							},
						],
						name: "Abaca bunchy top virus",
						schema: [],
						taxid: null,
						version: 0,
					},
				],
			);

			await seedUpload(nameOnDisk);
			await storage.write(STORAGE_KEY, once(await readFile(path)));
		} finally {
			await rm(workPath, { force: true, recursive: true });
		}

		expect(await run(await claim(nameOnDisk))).toEqual({ status: "completed" });

		const otuRows = await db
			.select()
			.from(legacyOtus)
			.where(eq(legacyOtus.reference_id, referenceId));

		expect(otuRows).toHaveLength(1);
		expect(otuRows[0]?.name).toBe("Abaca bunchy top virus");

		// The snapshot reader yields `id` where the JSON export writes `_id`;
		// both must reach the populate as the same document.
		expect(otuRows[0]?.data).toMatchObject({
			imported: true,
			remote: { id: "otu_source" },
		});

		expect(await db.select().from(legacySequences)).toHaveLength(1);
	});

	it("reports an abort during the read as aborted, not failed", async () => {
		await seedGzippedUpload(sourceData());

		const controller = new AbortController();
		const task = await claim();

		controller.abort();

		// An abort is the process going away, so the task is released rather
		// than failed against a file that is perfectly good.
		expect(await run(task, controller.signal)).toEqual({ status: "aborted" });

		expect(await readTaskRow(db, task.id)).toMatchObject({
			complete: false,
			error: null,
		});
	});

	it("surfaces a storage failure instead of hanging on the gunzip stream", async () => {
		await seedUpload(NAME_ON_DISK);

		// `.pipe()` would leave the consumer waiting on a gunzip stream nothing
		// ends; the source's rejection has to reach it.
		storage.read = () => {
			async function* fail(): AsyncIterable<Uint8Array> {
				yield gzipSync(Buffer.from("{"));

				throw new Error("storage went away mid-download");
			}

			return fail();
		};

		expect(await run(await claim())).toMatchObject({
			status: "failed",
			error: expect.stringContaining("storage went away mid-download"),
		});
	});

	it("fails a payload the schema rejects", async () => {
		await seedTaskRow(db, importReferenceTask.type, {
			name_on_disk: "",
			ref_id: referenceId,
			user_id: userId,
		});

		const task = await acquireOrThrow(db, importReferenceTask.type);

		expect(await run(task)).toMatchObject({ status: "failed" });
	});
});
