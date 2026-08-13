import { pipeline } from "node:stream/promises";
import { createGzip } from "node:zlib";
import type { HmmAnnotation } from "@virtool/contracts";
import type { Db } from "@virtool/data/db/pg";
import {
	HMM_STATUS_ID,
	type HmmRelease,
	type HmmUpdate,
	hmms,
	legacyHmmStatus,
} from "@virtool/data/db/schema/hmms";
import { tasks } from "@virtool/data/db/schema/tasks";
import {
	createTestDatabase,
	type TestDatabase,
} from "@virtool/data/db/test/fixtures";
import { isInstallInProgress } from "@virtool/data/hmm/data";
import type { ClaimedTask } from "@virtool/data/tasks/data";
import { createLogger, type Logger } from "@virtool/logger";
import {
	HMM_ANNOTATIONS_KEY,
	HMM_PROFILES_KEY,
	MemoryStorage,
	type StorageBackend,
} from "@virtool/storage";
import { eq } from "drizzle-orm";
import { pack } from "tar-stream";
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
import { runTask } from "../framework/run";
import { claimTask, readTaskRow } from "../testing/tasks";
import { installHmmsTask } from "./install-hmms";
import type { TaskContext } from "./registry";

const logger: Logger = createLogger({ name: "test", level: "silent" });

let database: TestDatabase;
let db: Db;
let storage: StorageBackend;
let ctx: TaskContext;

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

	storage = new MemoryStorage();
	ctx = { db, storage };
});

afterEach(() => {
	vi.unstubAllGlobals();
});

const RELEASE_ID = 4321;
const DOWNLOAD_URL = "https://www.virtool.ca/releases/hmm.tar.gz";

function createRelease(overrides: Partial<HmmRelease> = {}): HmmRelease {
	return {
		body: "notes",
		content_type: "application/gzip",
		download_url: DOWNLOAD_URL,
		filename: "hmm.tar.gz",
		html_url: "https://github.com/virtool/virtool-hmm/releases/v0.2.1",
		id: RELEASE_ID,
		name: "v0.2.1",
		newer: true,
		published_at: "2026-01-02T00:00:00Z",
		retrieved_at: "2026-01-03T00:00:00Z",
		size: 512,
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

type ArchiveMember = { name: string; body: string };

/** Build a `.tar.gz` in memory, as the release host serves one. */
async function buildArchive(members: ArchiveMember[]): Promise<Buffer> {
	const archive = pack();
	const chunks: Buffer[] = [];

	const collected = pipeline(archive, createGzip(), async (source) => {
		for await (const chunk of source) {
			chunks.push(chunk as Buffer);
		}
	});

	for (const member of members) {
		archive.entry({ name: member.name }, member.body);
	}

	archive.finalize();
	await collected;

	return Buffer.concat(chunks);
}

function releaseArchive(
	annotations: HmmAnnotation[],
	profiles = "HMMER3/f profiles",
	extra: ArchiveMember[] = [],
): Promise<Buffer> {
	return buildArchive([
		{ name: "hmm/annotations.json", body: JSON.stringify(annotations) },
		...extra,
		{ name: "hmm/profiles.hmm", body: profiles },
	]);
}

/** Serve `body` from `fetch`, or fail `failures` times first. */
function stubFetch(body: Buffer, options: { status?: number } = {}): void {
	vi.stubGlobal(
		"fetch",
		vi.fn(async () => {
			return new Response(new Uint8Array(body), {
				status: options.status ?? 200,
			});
		}),
	);
}

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
		size: 512,
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

async function claimInstall(
	release: HmmRelease = createRelease(),
): Promise<ClaimedTask> {
	return claimTask(db, installHmmsTask, {
		release: release as unknown as Record<string, unknown>,
		user_id: 1,
	});
}

function run(task: ClaimedTask, signal = new AbortController().signal) {
	return runTask({
		ctx,
		db,
		def: installHmmsTask,
		debounceMs: 0,
		logger,
		signal,
		task,
	});
}

async function listKeys(): Promise<string[]> {
	const keys: string[] = [];

	for await (const object of (storage as MemoryStorage).list("")) {
		keys.push(object.key);
	}

	return keys.sort();
}

describe("installHmmsTask", () => {
	it("downloads, extracts and installs a release", async () => {
		await seedPendingStatus();
		stubFetch(await releaseArchive([createAnnotation(1), createAnnotation(2)]));

		const task = await claimInstall();

		expect(await run(task)).toEqual({ status: "completed" });

		expect(await db.select().from(hmms)).toHaveLength(2);
		expect((await readStatus())?.updates[0]?.ready).toBe(true);
		expect(await listKeys()).toEqual(
			[HMM_ANNOTATIONS_KEY, HMM_PROFILES_KEY].sort(),
		);

		const row = await readTaskRow(db, task.id);
		expect(row.complete).toBe(true);
		expect(row.error).toBeNull();
		expect(row.progress).toBe(100);
	});

	it("leaves no install in progress afterwards", async () => {
		await seedPendingStatus();
		stubFetch(await releaseArchive([createAnnotation(1)]));

		await run(await claimInstall());

		expect(await isInstallInProgress(db)).toBe(false);
	});

	it.each([
		["annotations first", false],
		["profiles first", true],
	])("installs with %s in the archive", async (_label, profilesFirst) => {
		await seedPendingStatus();

		const annotations = [createAnnotation(1)];
		const members: ArchiveMember[] = [
			{ name: "hmm/annotations.json", body: JSON.stringify(annotations) },
			{ name: "hmm/profiles.hmm", body: "HMMER3/f" },
		];

		stubFetch(
			await buildArchive(profilesFirst ? [...members].reverse() : members),
		);

		expect(await run(await claimInstall())).toEqual({ status: "completed" });
		expect(await db.select().from(hmms)).toHaveLength(1);
	});

	/*
	 * The drain regression. An unwanted entry that is not resumed stalls the tar
	 * parser forever rather than failing, so this must complete under a timeout.
	 */
	it("completes when the archive carries entries it does not want", {
		timeout: 15_000,
	}, async () => {
		await seedPendingStatus();
		stubFetch(
			await releaseArchive([createAnnotation(1)], "HMMER3/f", [
				{ name: "hmm/README.md", body: "x".repeat(100_000) },
			]),
		);

		expect(await run(await claimInstall())).toEqual({ status: "completed" });
	});

	it("fails without installing when the archive escapes its directory", async () => {
		await seedPendingStatus();
		stubFetch(
			await buildArchive([
				{
					name: "hmm/annotations.json",
					body: JSON.stringify([createAnnotation(1)]),
				},
				{ name: "hmm/../../evil", body: "pwned" },
				{ name: "hmm/profiles.hmm", body: "HMMER3/f" },
			]),
		);

		const outcome = await run(await claimInstall());

		expect(outcome.status).toBe("failed");
		expect(await db.select().from(hmms)).toHaveLength(0);
		expect(await listKeys()).toEqual([]);
	});

	it("fails on a non-200 rather than trying to unpack the body", async () => {
		await seedPendingStatus();
		stubFetch(Buffer.from("<html>404 Not Found</html>"), { status: 404 });

		const outcome = await run(await claimInstall());

		expect(outcome.status).toBe("failed");
		expect(outcome).toMatchObject({
			error: expect.stringContaining("responded 404"),
		});
		expect(await db.select().from(hmms)).toHaveLength(0);
	});

	it("retries a transport failure and then succeeds", async () => {
		await seedPendingStatus();

		const archive = await releaseArchive([createAnnotation(1)]);
		let calls = 0;

		vi.stubGlobal(
			"fetch",
			vi.fn(async () => {
				calls += 1;

				if (calls === 1) {
					throw new TypeError("fetch failed");
				}

				return new Response(new Uint8Array(archive));
			}),
		);

		expect(await run(await claimInstall())).toEqual({ status: "completed" });
		expect(calls).toBe(2);
		expect(await db.select().from(hmms)).toHaveLength(1);
	});

	it("fails once the retry bound is exhausted", async () => {
		await seedPendingStatus();

		const fetchMock = vi.fn(async () => {
			throw new TypeError("fetch failed");
		});

		vi.stubGlobal("fetch", fetchMock);

		const outcome = await run(await claimInstall());

		expect(outcome.status).toBe("failed");
		expect(fetchMock).toHaveBeenCalledTimes(4);
	}, 30_000);

	it("completes on a release whose size is zero and whose annotations are empty", async () => {
		await seedPendingStatus();
		stubFetch(await releaseArchive([]));

		const outcome = await run(await claimInstall(createRelease({ size: 0 })));

		expect(outcome).toEqual({ status: "completed" });
		expect(await db.select().from(hmms)).toHaveLength(0);
	});

	it("fails a payload the schema rejects", async () => {
		await seedPendingStatus();

		const task = await claimTask(db, installHmmsTask, { user_id: 1 });
		const outcome = await run(task);

		expect(outcome.status).toBe("failed");
		expect(outcome).toMatchObject({
			error: expect.stringContaining("Invalid payload"),
		});
	});

	it("does not insert a second time when reclaimed after a completed install", async () => {
		await seedPendingStatus();
		stubFetch(await releaseArchive([createAnnotation(1), createAnnotation(2)]));

		await run(await claimInstall());
		expect(await db.select().from(hmms)).toHaveLength(2);

		// The reclaim: a fresh claim of a fresh row for the same release.
		await run(await claimInstall());

		expect(await db.select().from(hmms)).toHaveLength(2);
	});
});

describe("installHmmsTask cleanup", () => {
	it("clears the status when the task fails", async () => {
		await seedPendingStatus();
		stubFetch(Buffer.from("<html>nope</html>"), { status: 500 });

		expect((await run(await claimInstall())).status).toBe("failed");

		const status = await readStatus();

		expect(status?.updates).toEqual([]);
		expect(status?.installed).toBeNull();
	});

	/*
	 * The whole reason the framework's `cleanup` takes a reason. An aborted task
	 * is released and claimed again, and `cleanHmmStatus` would strip the entry
	 * the re-run reads to decide whether the install already committed — leaving
	 * a run that writes every row and records none of it.
	 */
	it("leaves the status alone when the task is aborted", async () => {
		await seedPendingStatus();

		const controller = new AbortController();

		vi.stubGlobal(
			"fetch",
			vi.fn(async () => {
				controller.abort();
				throw new Error("aborted mid-download");
			}),
		);

		expect((await run(await claimInstall(), controller.signal)).status).toBe(
			"aborted",
		);

		const status = await readStatus();

		expect(status?.updates).toHaveLength(1);
		expect(status?.updates[0]?.ready).toBe(false);
	});
});
