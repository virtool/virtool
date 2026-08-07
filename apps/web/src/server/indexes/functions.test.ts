import type { Db } from "@virtool/data/db/pg";
import { legacyHistory } from "@virtool/data/db/schema/history";
import { indexes, indexFiles } from "@virtool/data/db/schema/indexes";
import { legacyOtus } from "@virtool/data/db/schema/otus";
import {
	legacyReferences,
	legacyReferenceUsers,
} from "@virtool/data/db/schema/references";
import { sessions } from "@virtool/data/db/schema/sessions";
import { tasks } from "@virtool/data/db/schema/tasks";
import { users } from "@virtool/data/db/schema/users";
import {
	createTestDatabase,
	type TestDatabase,
} from "@virtool/data/db/test/fixtures";
import {
	seedChange,
	seedIndex,
	seedOtu,
	seedReference,
} from "@virtool/data/indexes/test/fixtures";
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

const emit = vi.fn();
vi.mock("@virtool/data/events/emit", () => ({
	createEmitter: vi.fn(),
	emit: (...args: unknown[]) => emit(...args),
}));

const handlers = (await import(
	"./functions.ts?tss-serverfn-split"
)) as SplitServerFnModule;
const { ForbiddenError, UnauthorizedError } = await import(
	"../auth/middleware"
);
const { signIn } = await import("../auth/test/fixtures");

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
	await db.delete(sessions);
	await db.delete(indexFiles);
	await db.delete(legacyHistory);
	await db.delete(legacyOtus);
	await db.delete(indexes);
	await db.delete(legacyReferenceUsers);
	await db.delete(legacyReferences);
	await db.delete(tasks);
	await db.delete(users);

	getRequest.mockReturnValue(
		new Request("https://virtool.test/_serverFn/test"),
	);
});

// Handles are unique case-insensitively, so every signed-in user needs its own.
let handleCounter = 0;

function signInAsNewUser(): Promise<number> {
	handleCounter += 1;
	return signIn(db, getRequest, { handle: `user-${handleCounter}` });
}

// A reference the caller may build: one verified OTU and one unbuilt change,
// which is the minimum `createIndex` accepts.
async function seedBuildableReference(
	userId: number,
	{ archived = false, build = true } = {},
): Promise<number> {
	const referenceId = await seedReference(db, userId, {
		archived,
		member: { build },
	});

	const otuId = await seedOtu(db, referenceId, { name: "Test virus" });

	await seedChange(db, {
		referenceId,
		userId,
		otuId,
		otuName: "Test virus",
		description: "Created Test virus",
		methodName: "create",
	});

	return referenceId;
}

function call(name: string, data?: unknown) {
	return callServerFn(handlers, name, data);
}

describe("authorization", () => {
	it("refuses every function without a session", async () => {
		await expect(
			call("findIndexesFn", { referenceId: 1, page: 1, perPage: 25 }),
		).rejects.toBeInstanceOf(UnauthorizedError);
		await expect(call("listReadyIndexesFn", {})).rejects.toBeInstanceOf(
			UnauthorizedError,
		);
		await expect(call("getIndexFn", { indexId: 1 })).rejects.toBeInstanceOf(
			UnauthorizedError,
		);
		await expect(
			call("findUnbuiltChangesFn", { referenceId: 1, page: 1, perPage: 25 }),
		).rejects.toBeInstanceOf(UnauthorizedError);
		await expect(
			call("createIndexFn", { referenceId: 1 }),
		).rejects.toBeInstanceOf(UnauthorizedError);
	});

	it("refuses a build without the reference's build right", async () => {
		const userId = await signInAsNewUser();
		const referenceId = await seedBuildableReference(userId, { build: false });

		await expect(call("createIndexFn", { referenceId })).rejects.toBeInstanceOf(
			ForbiddenError,
		);
	});
});

describe("getIndexFn", () => {
	it("answers 404 for an index that does not exist", async () => {
		await signInAsNewUser();

		await expect(call("getIndexFn", { indexId: 404 })).rejects.toThrow(
			"Index not found.",
		);
		expect(setResponseStatus).toHaveBeenCalledWith(404);
	});
});

describe("findUnbuiltChangesFn", () => {
	it("returns only the changes no build covers yet", async () => {
		const userId = await signInAsNewUser();
		const referenceId = await seedBuildableReference(userId);

		const built = await seedIndex(db, { referenceId, userId, version: 0 });
		const builtOtuId = await seedOtu(db, referenceId, {
			name: "Built virus",
		});

		await seedChange(db, {
			referenceId,
			userId,
			otuId: builtOtuId,
			otuName: "Built virus",
			description: "Already built",
			indexId: built,
		});

		const result = (await call("findUnbuiltChangesFn", {
			referenceId,
			page: 1,
			perPage: 25,
		})) as {
			items: { description: string; index: unknown }[];
			foundCount: number;
			totalCount: number;
		};

		// `totalCount` counts every change in the reference so a caller can tell
		// "nothing unbuilt" from "no history at all".
		expect(result.totalCount).toBe(2);
		expect(result.foundCount).toBe(1);
		expect(result.items).toHaveLength(1);
		expect(result.items[0]?.description).toBe("Created Test virus");
		expect(result.items[0]?.index).toBeNull();
	});
});

describe("createIndexFn", () => {
	it("builds the index and announces it", async () => {
		const userId = await signInAsNewUser();
		const referenceId = await seedBuildableReference(userId);

		const index = (await call("createIndexFn", { referenceId })) as {
			id: number;
			version: number;
			ready: boolean;
		};

		expect(index.version).toBe(0);
		expect(index.ready).toBe(false);
		expect(setResponseStatus).toHaveBeenCalledWith(201);
		// The integer id, not a stringified one — the client's `SseMessageSchema`
		// rejects a string here and would drop the invalidation (VIR-2794).
		expect(emit).toHaveBeenCalledWith("indexes", index.id, "create");
	});

	it("answers 409 for an archived reference", async () => {
		const userId = await signInAsNewUser();
		const referenceId = await seedBuildableReference(userId, {
			archived: true,
		});

		await expect(call("createIndexFn", { referenceId })).rejects.toThrow(
			"Reference is archived",
		);
		expect(setResponseStatus).toHaveBeenCalledWith(409);
	});

	it("answers 409 when a build is already in progress", async () => {
		const userId = await signInAsNewUser();
		const referenceId = await seedBuildableReference(userId);

		await seedIndex(db, { referenceId, userId, version: 0, ready: false });

		await expect(call("createIndexFn", { referenceId })).rejects.toThrow(
			"Index build already in progress",
		);
		expect(setResponseStatus).toHaveBeenCalledWith(409);
	});

	// Both "nothing to build" outcomes are 400s upstream rather than conflicts,
	// and the rebuild dialog matches on the unverified message to explain it.
	it("answers 400 for unverified OTUs", async () => {
		const userId = await signInAsNewUser();
		const referenceId = await seedBuildableReference(userId);

		await seedOtu(db, referenceId, {
			name: "Unverified virus",
			verified: false,
		});

		await expect(call("createIndexFn", { referenceId })).rejects.toThrow(
			"There are unverified OTUs",
		);
		expect(setResponseStatus).toHaveBeenCalledWith(400);
	});

	it("answers 400 when there is nothing to build", async () => {
		const userId = await signInAsNewUser();
		const referenceId = await seedReference(db, userId, {
			member: { build: true },
		});

		await expect(call("createIndexFn", { referenceId })).rejects.toThrow(
			"There are no unbuilt changes",
		);
		expect(setResponseStatus).toHaveBeenCalledWith(400);
	});
});
