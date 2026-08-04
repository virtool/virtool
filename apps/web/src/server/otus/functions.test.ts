import type { Db } from "@virtool/data/db/pg";
import { takeFirstOrThrow } from "@virtool/data/db/rows";
import {
	legacyHistory,
	legacyHistoryDiff,
} from "@virtool/data/db/schema/history";
import { legacyOtus, legacySequences } from "@virtool/data/db/schema/otus";
import {
	legacyReferences,
	legacyReferenceUsers,
} from "@virtool/data/db/schema/references";
import { sessions } from "@virtool/data/db/schema/sessions";
import { users } from "@virtool/data/db/schema/users";
import {
	createTestDatabase,
	type TestDatabase,
} from "@virtool/data/db/test/fixtures";
import { eq } from "drizzle-orm";
import {
	afterAll,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	vi,
} from "vitest";
import { callServerFn, type SplitServerFnModule } from "../test/serverFn";

const getRequest = vi.fn();
const setResponseStatus = vi.fn();

vi.mock("@tanstack/react-start/server", () => ({
	deleteCookie: vi.fn(),
	getCookie: vi.fn(),
	getRequest,
	setCookie: vi.fn(),
	setResponseStatus,
}));

vi.mock("@sentry/tanstackstart-react", () => ({
	captureException: vi.fn(),
	setUser: vi.fn(),
}));

let db: Db;
vi.mock("../composition", () => ({
	client: {},
	get db() {
		return db;
	},
}));

const handlers = (await import(
	"./functions.ts?tss-serverfn-split"
)) as SplitServerFnModule;
const { signIn } = await import("../auth/test/fixtures");
const { createIsolate, createOtu } = await import("@virtool/data/otus/data");

let database: TestDatabase;

beforeAll(async () => {
	database = await createTestDatabase();
	db = database.db;
}, 60_000);

afterAll(async () => {
	await database.drop();
});

beforeEach(async () => {
	vi.clearAllMocks();
	await db.delete(legacyHistoryDiff);
	await db.delete(legacyHistory);
	await db.delete(legacySequences);
	await db.delete(legacyOtus);
	await db.delete(sessions);
	await db.delete(legacyReferenceUsers);
	await db.delete(legacyReferences);
	await db.delete(users);
});

async function seedReference(
	ownerId: number,
	{ modifyOtu = true }: { modifyOtu?: boolean } = {},
): Promise<number> {
	const reference = takeFirstOrThrow(
		await db
			.insert(legacyReferences)
			.values({
				name: "Reference",
				description: "",
				organism: "virus",
				created_at: new Date(),
				archived: false,
				restrict_source_types: false,
				source_types: [],
				user_id: ownerId,
			})
			.returning({ id: legacyReferences.id }),
	);

	await db.insert(legacyReferenceUsers).values({
		reference_id: reference.id,
		user_id: ownerId,
		build: true,
		modify: true,
		modify_otu: modifyOtu,
	});

	return reference.id;
}

async function archive(referenceId: number): Promise<void> {
	await db
		.update(legacyReferences)
		.set({ archived: true })
		.where(eq(legacyReferences.id, referenceId));
}

function call(name: string, data?: unknown) {
	return callServerFn(handlers, name, data);
}

describe("authorizeOtu", () => {
	it("maps a missing OTU to a 404", async () => {
		await signIn(db, getRequest);

		await expect(
			call("updateOtuFn", { otuId: "nope", name: "X" }),
		).rejects.toThrow("OTU not found.");
		expect(setResponseStatus).toHaveBeenCalledWith(404);
	});

	it("maps an isolate the OTU does not carry to a 404", async () => {
		const userId = await signIn(db, getRequest);
		const referenceId = await seedReference(userId);
		const otu = await createOtu(
			db,
			referenceId,
			{ name: "Alpha", abbreviation: "", schema: [] },
			userId,
		);

		await expect(
			call("setIsolateAsDefaultFn", { otuId: otu.id, isolateId: "nope" }),
		).rejects.toThrow("OTU or isolate not found.");
		expect(setResponseStatus).toHaveBeenCalledWith(404);
	});

	it("refuses a caller without modify_otu with a 403", async () => {
		const userId = await signIn(db, getRequest);
		const referenceId = await seedReference(userId, { modifyOtu: false });
		const otu = await createOtu(
			db,
			referenceId,
			{ name: "Alpha", abbreviation: "", schema: [] },
			userId,
		);

		await expect(
			call("updateOtuFn", { otuId: otu.id, name: "Beta" }),
		).rejects.toThrow();
		expect(setResponseStatus).toHaveBeenCalledWith(403);
	});

	it("updates an OTU in an active reference", async () => {
		const userId = await signIn(db, getRequest);
		const referenceId = await seedReference(userId);
		const otu = await createOtu(
			db,
			referenceId,
			{ name: "Alpha", abbreviation: "", schema: [] },
			userId,
		);

		const updated = (await call("updateOtuFn", {
			otuId: otu.id,
			name: "Beta",
		})) as { name: string };

		expect(updated.name).toBe("Beta");
	});

	// An archived reference is read-only. The UI hides every edit control, but
	// the floor has to hold for a direct or stale RPC call too.
	it("refuses an OTU update in an archived reference with a 409", async () => {
		const userId = await signIn(db, getRequest);
		const referenceId = await seedReference(userId);
		const otu = await createOtu(
			db,
			referenceId,
			{ name: "Alpha", abbreviation: "", schema: [] },
			userId,
		);

		await archive(referenceId);

		await expect(
			call("updateOtuFn", { otuId: otu.id, name: "Beta" }),
		).rejects.toThrow("Reference is archived.");
		expect(setResponseStatus).toHaveBeenCalledWith(409);
	});

	it("refuses a sequence write in an archived reference with a 409", async () => {
		const userId = await signIn(db, getRequest);
		const referenceId = await seedReference(userId);
		const otu = await createOtu(
			db,
			referenceId,
			{ name: "Alpha", abbreviation: "", schema: [] },
			userId,
		);
		const isolate = await createIsolate(
			db,
			otu.id,
			{ default: true, sourceName: "Ever", sourceType: "isolate" },
			userId,
		);

		await archive(referenceId);

		await expect(
			call("createSequenceFn", {
				otuId: otu.id,
				isolateId: isolate.id,
				accession: "NC_1",
				definition: "Alpha",
				host: "",
				sequence: "ATGC",
				segment: null,
				target: null,
			}),
		).rejects.toThrow("Reference is archived.");
		expect(setResponseStatus).toHaveBeenCalledWith(409);
	});

	it("refuses an isolate delete in an archived reference with a 409", async () => {
		const userId = await signIn(db, getRequest);
		const referenceId = await seedReference(userId);
		const otu = await createOtu(
			db,
			referenceId,
			{ name: "Alpha", abbreviation: "", schema: [] },
			userId,
		);
		const isolate = await createIsolate(
			db,
			otu.id,
			{ default: true, sourceName: "Ever", sourceType: "isolate" },
			userId,
		);

		await archive(referenceId);

		await expect(
			call("deleteIsolateFn", { otuId: otu.id, isolateId: isolate.id }),
		).rejects.toThrow("Reference is archived.");
		expect(setResponseStatus).toHaveBeenCalledWith(409);
	});
});
