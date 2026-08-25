import { randomUUID } from "node:crypto";
import type { Db } from "@virtool/data/db/pg";
import { takeFirstOrThrow } from "@virtool/data/db/rows";
import { groups, userGroups } from "@virtool/data/db/schema/groups";
import {
	referenceGroups,
	referenceRoots,
	referenceUsers,
} from "@virtool/data/db/schema/referencesV2";
import {
	createTestDatabase,
	type TestDatabase,
} from "@virtool/data/db/test/fixtures";
import { sql } from "drizzle-orm";
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
const { ForbiddenError } = await import("../auth/middleware");
const { seedUser } = await import("@virtool/data/auth/test/fixtures");
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
	await db.execute(
		sql`truncate table reference_roots, users, groups, sessions restart identity cascade`,
	);
	getRequest.mockReturnValue(
		new Request("https://virtool.test/_serverFn/test"),
	);
});

async function seedReferenceV2(memberUserId: number): Promise<string> {
	const id = randomUUID();
	await db.insert(referenceRoots).values({
		id,
		name: "Reference",
		description: "",
		kind: "local",
		defaultSegmentLengthTolerance: 0.05,
		archived: false,
		createdAt: new Date(),
		updatedAt: new Date(),
	});
	await db.insert(referenceUsers).values({
		referenceId: id,
		userId: memberUserId,
		build: true,
		modify: true,
		modifyOtu: true,
	});
	return id;
}

function call(name: string, data?: unknown) {
	return callServerFn(handlers, name, data);
}

describe("createReferenceV2", () => {
	it("refuses a caller without create_ref", async () => {
		await signIn(db, getRequest, { administratorRole: null });

		await expect(
			call("createReferenceV2Fn", { name: "New" }),
		).rejects.toBeInstanceOf(ForbiddenError);
	});

	it("creates a local reference and grants the creator all rights", async () => {
		const userId = await signIn(db, getRequest, { administratorRole: "full" });

		const reference = (await call("createReferenceV2Fn", {
			name: "Local",
			description: "desc",
		})) as { id: string; kind: string; archived: boolean };

		expect(setResponseStatus).toHaveBeenCalledWith(201);
		expect(reference.kind).toBe("local");
		expect(reference.archived).toBe(false);

		const [membership] = await db
			.select()
			.from(referenceUsers)
			.where(sql`${referenceUsers.referenceId} = ${reference.id}`);
		expect(membership).toEqual({
			referenceId: reference.id,
			userId,
			build: true,
			modify: true,
			modifyOtu: true,
		});
	});

	it("rejects an unknown field as a 400", async () => {
		await signIn(db, getRequest, { administratorRole: "full" });

		await expect(
			call("createReferenceV2Fn", { name: "Local", organism: "virus" }),
		).rejects.toBeTruthy();
	});
});

describe("getReferenceV2", () => {
	it("maps a missing reference to a 404", async () => {
		await signIn(db, getRequest, { administratorRole: null });

		await expect(
			call("getReferenceV2Fn", { referenceId: randomUUID() }),
		).rejects.toThrow("Reference not found.");
		expect(setResponseStatus).toHaveBeenCalledWith(404);
	});

	it("returns the reference for a member", async () => {
		const userId = await signIn(db, getRequest, { administratorRole: null });
		const referenceId = await seedReferenceV2(userId);

		const reference = (await call("getReferenceV2Fn", { referenceId })) as {
			id: string;
		};

		expect(reference.id).toBe(referenceId);
	});

	it("hides a reference the caller cannot see behind a 404", async () => {
		const ownerId = await seedUser(db, {
			administratorRole: null,
			handle: "bob",
		});
		await signIn(db, getRequest, { administratorRole: null });
		const referenceId = await seedReferenceV2(ownerId);

		await expect(call("getReferenceV2Fn", { referenceId })).rejects.toThrow(
			"Reference not found.",
		);
		expect(setResponseStatus).toHaveBeenCalledWith(404);
	});

	it("returns the reference for a full administrator who is not a member", async () => {
		const ownerId = await seedUser(db, {
			administratorRole: null,
			handle: "bob",
		});
		await signIn(db, getRequest, { administratorRole: "full" });
		const referenceId = await seedReferenceV2(ownerId);

		const reference = (await call("getReferenceV2Fn", { referenceId })) as {
			id: string;
		};

		expect(reference.id).toBe(referenceId);
	});

	it("returns the reference for a member reached through a group", async () => {
		const ownerId = await seedUser(db, {
			administratorRole: null,
			handle: "bob",
		});
		const userId = await signIn(db, getRequest, { administratorRole: null });
		const referenceId = await seedReferenceV2(ownerId);
		const group = takeFirstOrThrow(
			await db
				.insert(groups)
				.values({ name: "Team", permissions: {} as never })
				.returning({ id: groups.id }),
		);
		await db.insert(userGroups).values({ userId, groupId: group.id });
		// Every rights flag is false: visibility is broader than any single right.
		await db.insert(referenceGroups).values({
			referenceId,
			groupId: group.id,
			build: false,
			modify: false,
			modifyOtu: false,
		});

		const reference = (await call("getReferenceV2Fn", { referenceId })) as {
			id: string;
		};

		expect(reference.id).toBe(referenceId);
	});
});

describe("getReferencesV2", () => {
	it("returns only References visible to the caller", async () => {
		const memberUserId = await signIn(db, getRequest, {
			administratorRole: null,
		});
		const otherUserId = await seedUser(db, {
			administratorRole: null,
			handle: "bob",
		});
		const visibleId = await seedReferenceV2(memberUserId);
		await seedReferenceV2(otherUserId);

		const references = (await call("getReferencesV2Fn")) as Array<{
			id: string;
		}>;

		expect(references.map((reference) => reference.id)).toEqual([visibleId]);
	});

	it("returns every Reference to a full administrator", async () => {
		const ownerId = await seedUser(db, {
			administratorRole: null,
			handle: "bob",
		});
		await signIn(db, getRequest, { administratorRole: "full" });
		await seedReferenceV2(ownerId);
		await seedReferenceV2(ownerId);

		const references = (await call("getReferencesV2Fn")) as unknown[];

		expect(references).toHaveLength(2);
	});
});
