import { eq } from "drizzle-orm";
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
import { groups, userGroups } from "../db/schema/groups";
import {
	HMM_STATUS_ID,
	type HmmUpdate,
	hmms,
	legacyHmmStatus,
} from "../db/schema/hmms";
import { sessions } from "../db/schema/sessions";
import { tasks } from "../db/schema/tasks";
import { users } from "../db/schema/users";
import { createTestDatabase, type TestDatabase } from "../db/test/fixtures";
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
vi.mock("../db/pg", () => ({
	client: {},
	get db() {
		return db;
	},
}));

const handlers = (await import(
	"./functions.ts?tss-serverfn-split"
)) as SplitServerFnModule;
const { SESSION_ID_COOKIE, SESSION_TOKEN_COOKIE } = await import(
	"../auth/cookies"
);
const { seedSession, seedUser } = await import("../auth/test/fixtures");
const { addToGroup, seedGroup } = await import("../groups/test/fixtures");

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
	await db.delete(userGroups);
	await db.delete(sessions);
	await db.delete(users);
	await db.delete(groups);
	await db.delete(legacyHmmStatus);
	await db.delete(hmms);
	await db.delete(tasks);
	getRequest.mockReturnValue(
		new Request("https://virtool.test/_serverFn/test"),
	);
});

afterEach(() => {
	vi.restoreAllMocks();
});

/** Authenticate the next call as the given already-seeded user. */
async function authenticateAs(userId: number): Promise<void> {
	const { sessionId, token } = await seedSession(db, userId);

	getRequest.mockReturnValue(
		new Request("https://virtool.test/_serverFn/test", {
			headers: {
				cookie: `${SESSION_ID_COOKIE}=${sessionId}; ${SESSION_TOKEN_COOKIE}=${token}`,
			},
		}),
	);
}

/** Authenticate the next call as a user with the given administrator role. */
async function signIn(role: "full" | "base" | null): Promise<number> {
	const userId = await seedUser(db, { administratorRole: role });
	await authenticateAs(userId);
	return userId;
}

function seedStatus(
	values: { updates?: HmmUpdate[]; release?: unknown } = {},
): Promise<unknown> {
	return db.insert(legacyHmmStatus).values({
		id: HMM_STATUS_ID,
		errors: [],
		updates: values.updates ?? [],
		release: (values.release ?? null) as never,
	});
}

function mockManifest(releases: unknown[]): void {
	vi.spyOn(globalThis, "fetch").mockResolvedValue(
		new Response(JSON.stringify({ "virtool-hmm": releases }), { status: 200 }),
	);
}

const RELEASE = {
	body: "notes",
	content_type: "application/gzip",
	download_url: "https://example.test/hmm.tar.gz",
	filename: "hmm.tar.gz",
	html_url: "https://example.test/release",
	id: 11,
	name: "v2.0.0",
	published_at: "2024-01-01T00:00:00Z",
	size: 1024,
};

function call(name: string, data?: unknown) {
	return callServerFn(handlers, name, data);
}

describe("installHmm", () => {
	it("creates a pending install task and points the status at it", async () => {
		const userId = await signIn("base");
		await seedStatus();
		mockManifest([RELEASE]);

		const installed = (await call("installHmmFn")) as {
			name: string;
			ready: boolean;
			user: { id: number; handle: string };
		};

		expect(installed).toMatchObject({
			name: "v2.0.0",
			ready: false,
			user: { id: userId },
		});
		expect(setResponseStatus).toHaveBeenCalledWith(201);

		const [task] = await db.select().from(tasks);
		expect(task).toMatchObject({
			type: "install_hmms",
			complete: false,
			progress: 0,
			acquired_at: null,
		});

		const [status] = await db
			.select()
			.from(legacyHmmStatus)
			.where(eq(legacyHmmStatus.id, HMM_STATUS_ID));
		expect(status?.task_id).toBe(task?.id);
		expect(status?.updates).toHaveLength(1);
		expect(status?.updates[0]?.ready).toBe(false);
	});

	it("allows a modify_hmm group member without an admin role", async () => {
		const userId = await seedUser(db, { administratorRole: null });
		const groupId = await seedGroup(db, {
			name: "hmm-managers",
			permissions: { modify_hmm: true },
		});
		await addToGroup(db, userId, groupId);
		await authenticateAs(userId);

		await seedStatus();
		mockManifest([RELEASE]);

		const installed = (await call("installHmmFn")) as {
			user: { id: number };
		};

		expect(installed).toMatchObject({ user: { id: userId } });
		expect(setResponseStatus).toHaveBeenCalledWith(201);
	});

	it("refuses when an install is already in progress", async () => {
		await signIn("base");
		await seedStatus({ updates: [{ ready: false } as HmmUpdate] });
		const fetchSpy = vi.spyOn(globalThis, "fetch");

		await expect(call("installHmmFn")).rejects.toThrow();
		expect(setResponseStatus).toHaveBeenCalledWith(409);
		expect(fetchSpy).not.toHaveBeenCalled();
		expect(await db.select().from(tasks)).toHaveLength(0);
	});

	it("returns a bad gateway when no release is available", async () => {
		await signIn("base");
		await seedStatus();
		mockManifest([]);

		await expect(call("installHmmFn")).rejects.toThrow();
		expect(setResponseStatus).toHaveBeenCalledWith(502);
		expect(await db.select().from(tasks)).toHaveLength(0);
	});
});

describe("getHmm", () => {
	it("responds 404 when the HMM is absent", async () => {
		await signIn("base");

		await expect(call("getHmmFn", { hmmId: 5000 })).rejects.toThrow();
		expect(setResponseStatus).toHaveBeenCalledWith(404);
	});
});
