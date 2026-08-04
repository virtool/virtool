import type { Db } from "@virtool/data/db/pg";
import { takeFirstOrThrow } from "@virtool/data/db/rows";
import { groups, userGroups } from "@virtool/data/db/schema/groups";
import {
	legacyReferenceGroups,
	legacyReferences,
	legacyReferenceUsers,
} from "@virtool/data/db/schema/references";
import { sessions } from "@virtool/data/db/schema/sessions";
import { tasks } from "@virtool/data/db/schema/tasks";
import { uploads } from "@virtool/data/db/schema/uploads";
import { users } from "@virtool/data/db/schema/users";
import {
	createTestDatabase,
	type TestDatabase,
} from "@virtool/data/db/test/fixtures";
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
	await db.delete(sessions);
	await db.delete(legacyReferenceUsers);
	await db.delete(legacyReferenceGroups);
	await db.delete(legacyReferences);
	await db.delete(tasks);
	await db.delete(uploads);
	await db.delete(userGroups);
	await db.delete(groups);
	await db.delete(users);
	getRequest.mockReturnValue(
		new Request("https://virtool.test/_serverFn/test"),
	);
});

// `create_ref` is a "base"-role permission, so any administrator holds it; a
// role-less user does not.

async function seedReference(
	ownerId: number,
	options: { archived?: boolean; memberUserId?: number } = {},
): Promise<number> {
	const reference = takeFirstOrThrow(
		await db
			.insert(legacyReferences)
			.values({
				name: "Reference",
				description: "",
				organism: "virus",
				created_at: new Date(),
				archived: options.archived ?? false,
				restrict_source_types: false,
				source_types: [],
				user_id: ownerId,
			})
			.returning({ id: legacyReferences.id }),
	);

	// The owner is seeded as a full-rights member, matching creation.
	await db.insert(legacyReferenceUsers).values({
		reference_id: reference.id,
		user_id: options.memberUserId ?? ownerId,
		build: true,
		modify: true,
		modify_otu: true,
	});

	return reference.id;
}

async function seedUpload(userId: number): Promise<number> {
	return takeFirstOrThrow(
		await db
			.insert(uploads)
			.values({
				createdAt: new Date(),
				name: "reference.json.gz",
				nameOnDisk: `disk-${Math.random()}`,
				userId,
			})
			.returning({ id: uploads.id }),
	).id;
}

function call(name: string, data?: unknown) {
	return callServerFn(handlers, name, data);
}

describe("findReferences", () => {
	it("returns only references the caller can see", async () => {
		const ownerId = await signIn(db, getRequest, { administratorRole: null });
		const otherId = await seedUser(db, {
			administratorRole: null,
			handle: "bob",
		});
		await seedReference(ownerId);
		await seedReference(otherId);

		const result = (await call("findReferencesFn", {
			page: 1,
			per_page: 25,
		})) as {
			items: { user: { id: number } | null }[];
			totalCount: number;
		};

		expect(result.totalCount).toBe(1);
		expect(result.items).toHaveLength(1);
		expect(result.items[0]?.user?.id).toBe(ownerId);
	});

	it("returns every reference for a full administrator", async () => {
		const adminId = await signIn(db, getRequest, { administratorRole: "full" });
		const otherId = await seedUser(db, {
			administratorRole: null,
			handle: "bob",
		});
		await seedReference(adminId);
		await seedReference(otherId);

		const result = (await call("findReferencesFn", {
			page: 1,
			per_page: 25,
		})) as {
			totalCount: number;
		};

		expect(result.totalCount).toBe(2);
	});
});

describe("getReference", () => {
	it("maps a missing reference to a 404", async () => {
		await signIn(db, getRequest, { administratorRole: null });

		await expect(
			call("getReferenceFn", { referenceId: 999_999 }),
		).rejects.toThrow("Reference not found.");
		expect(setResponseStatus).toHaveBeenCalledWith(404);
	});

	it("returns the detail with its seeded owner membership", async () => {
		const ownerId = await signIn(db, getRequest, { administratorRole: null });
		const referenceId = await seedReference(ownerId);

		const reference = (await call("getReferenceFn", { referenceId })) as {
			users: { id: number; modifyOtu: boolean }[];
			sourceTypes: string[];
		};

		expect(reference.users).toHaveLength(1);
		expect(reference.users[0]?.id).toBe(ownerId);
		expect(reference.users[0]?.modifyOtu).toBe(true);
	});

	it("hides a reference the caller cannot see behind a 404", async () => {
		const ownerId = await seedUser(db, {
			administratorRole: null,
			handle: "bob",
		});
		await signIn(db, getRequest, { administratorRole: null });
		const referenceId = await seedReference(ownerId);

		await expect(call("getReferenceFn", { referenceId })).rejects.toThrow(
			"Reference not found.",
		);
		expect(setResponseStatus).toHaveBeenCalledWith(404);
	});

	it("returns the detail for a full administrator who is not a member", async () => {
		const ownerId = await seedUser(db, {
			administratorRole: null,
			handle: "bob",
		});
		await signIn(db, getRequest, { administratorRole: "full" });
		const referenceId = await seedReference(ownerId);

		const reference = (await call("getReferenceFn", { referenceId })) as {
			id: number;
		};

		expect(reference.id).toBe(referenceId);
	});

	it("returns the detail for a member reached through a group, regardless of rights", async () => {
		const ownerId = await seedUser(db, {
			administratorRole: null,
			handle: "bob",
		});
		const userId = await signIn(db, getRequest, { administratorRole: null });
		const referenceId = await seedReference(ownerId);
		const group = takeFirstOrThrow(
			await db
				.insert(groups)
				.values({ name: "Team", permissions: {} as never })
				.returning({ id: groups.id }),
		);
		await db.insert(userGroups).values({ userId, groupId: group.id });
		// Every rights flag is false: visibility is broader than any single right.
		await db.insert(legacyReferenceGroups).values({
			reference_id: referenceId,
			group_id: group.id,
			build: false,
			modify: false,
			modify_otu: false,
		});

		const reference = (await call("getReferenceFn", { referenceId })) as {
			id: number;
		};

		expect(reference.id).toBe(referenceId);
	});
});

describe("createReference", () => {
	it("refuses a caller without create_ref", async () => {
		await signIn(db, getRequest, { administratorRole: null });

		await expect(
			call("createReferenceFn", { name: "New", description: "", organism: "" }),
		).rejects.toBeInstanceOf(ForbiddenError);
	});

	it("creates an empty reference and seeds the creator with all rights", async () => {
		const userId = await signIn(db, getRequest, { administratorRole: "full" });

		const reference = (await call("createReferenceFn", {
			name: "Empty",
			description: "desc",
			organism: "virus",
		})) as { id: number; sourceTypes: string[]; users: { id: number }[] };

		expect(setResponseStatus).toHaveBeenCalledWith(201);
		expect(reference.sourceTypes).toEqual(["isolate", "strain"]);
		expect(reference.users).toHaveLength(1);
		expect(reference.users[0]?.id).toBe(userId);
	});

	it("schedules a clone task and records the source", async () => {
		const userId = await signIn(db, getRequest, { administratorRole: "full" });
		const sourceId = await seedReference(userId);

		const reference = (await call("createReferenceFn", {
			name: "",
			description: "",
			organism: "",
			cloneFrom: sourceId,
		})) as { clonedFrom: { id: number } | null; task: { id: number } | null };

		expect(reference.clonedFrom?.id).toBe(sourceId);
		expect(reference.task).not.toBeNull();

		const taskRows = await db.select({ type: tasks.type }).from(tasks);
		expect(taskRows.some((row) => row.type === "clone_reference")).toBe(true);
	});

	it("maps a missing import upload to a 400", async () => {
		await signIn(db, getRequest, { administratorRole: "full" });

		await expect(
			call("createReferenceFn", {
				name: "Imported",
				description: "",
				organism: "",
				importFrom: 999_999,
			}),
		).rejects.toThrow("Upload does not exist.");
		expect(setResponseStatus).toHaveBeenCalledWith(400);
	});

	it("imports from an existing upload", async () => {
		const userId = await signIn(db, getRequest, { administratorRole: "full" });
		const uploadId = await seedUpload(userId);

		const reference = (await call("createReferenceFn", {
			name: "Imported",
			description: "",
			organism: "",
			importFrom: uploadId,
		})) as { importedFrom: { id: number } | null; task: { id: number } | null };

		expect(reference.importedFrom?.id).toBe(uploadId);
		expect(reference.task).not.toBeNull();
	});
});

describe("updateReference", () => {
	it("refuses a caller without modify on the reference", async () => {
		const ownerId = await seedUser(db, {
			administratorRole: null,
			handle: "bob",
		});
		await signIn(db, getRequest, { administratorRole: null });
		const referenceId = await seedReference(ownerId);

		await expect(
			call("updateReferenceFn", { referenceId, name: "Renamed" }),
		).rejects.toBeInstanceOf(ForbiddenError);
	});

	it("updates only allow-listed fields for a member with modify", async () => {
		const ownerId = await signIn(db, getRequest, { administratorRole: null });
		const referenceId = await seedReference(ownerId);

		const reference = (await call("updateReferenceFn", {
			referenceId,
			name: "Renamed",
			restrictSourceTypes: true,
		})) as { name: string; restrictSourceTypes: boolean };

		expect(reference.name).toBe("Renamed");
		expect(reference.restrictSourceTypes).toBe(true);
	});

	it("rejects an update to an archived reference with a 409", async () => {
		const ownerId = await signIn(db, getRequest, { administratorRole: null });
		const referenceId = await seedReference(ownerId, { archived: true });

		await expect(
			call("updateReferenceFn", { referenceId, name: "Renamed" }),
		).rejects.toThrow("Reference is archived.");
		expect(setResponseStatus).toHaveBeenCalledWith(409);
	});
});

describe("archiveReference", () => {
	it("archives a reference for a member with modify", async () => {
		const ownerId = await signIn(db, getRequest, { administratorRole: null });
		const referenceId = await seedReference(ownerId);

		const reference = (await call("archiveReferenceFn", { referenceId })) as {
			archived: boolean;
		};

		expect(reference.archived).toBe(true);
	});
});

describe("reference membership", () => {
	it("adds a group member only when the caller has modify", async () => {
		const ownerId = await signIn(db, getRequest, { administratorRole: null });
		const referenceId = await seedReference(ownerId);
		const group = takeFirstOrThrow(
			await db
				.insert(groups)
				.values({ name: "Team", permissions: {} as never })
				.returning({ id: groups.id }),
		);

		const member = (await call("addReferenceGroupFn", {
			referenceId,
			groupId: group.id,
			modify: true,
		})) as { id: number; modify: boolean };

		expect(setResponseStatus).toHaveBeenCalledWith(201);
		expect(member.id).toBe(group.id);
		expect(member.modify).toBe(true);
	});

	it("refuses adding a group member without modify (closing the Python asymmetry)", async () => {
		const ownerId = await seedUser(db, {
			administratorRole: null,
			handle: "bob",
		});
		await signIn(db, getRequest, { administratorRole: null });
		const referenceId = await seedReference(ownerId);
		const group = takeFirstOrThrow(
			await db
				.insert(groups)
				.values({ name: "Team", permissions: {} as never })
				.returning({ id: groups.id }),
		);

		await expect(
			call("addReferenceGroupFn", { referenceId, groupId: group.id }),
		).rejects.toBeInstanceOf(ForbiddenError);
	});

	it("partially merges a member's rights on update", async () => {
		const ownerId = await signIn(db, getRequest, { administratorRole: null });
		const referenceId = await seedReference(ownerId);

		const member = (await call("updateReferenceUserFn", {
			referenceId,
			userId: ownerId,
			modify: false,
		})) as { build: boolean; modify: boolean; modifyOtu: boolean };

		// Only `modify` was sent, so `build` and `modifyOtu` keep their seeded true.
		expect(member.modify).toBe(false);
		expect(member.build).toBe(true);
		expect(member.modifyOtu).toBe(true);
	});

	it("maps removing a non-existent member to a 404", async () => {
		const ownerId = await signIn(db, getRequest, { administratorRole: null });
		const referenceId = await seedReference(ownerId);

		await expect(
			call("removeReferenceUserFn", { referenceId, userId: 999_999 }),
		).rejects.toThrow("Member not found.");
		expect(setResponseStatus).toHaveBeenCalledWith(404);
	});
});
