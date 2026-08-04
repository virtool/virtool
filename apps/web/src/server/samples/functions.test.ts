import type { Db } from "@virtool/data/db/pg";
import { takeFirstOrThrow } from "@virtool/data/db/rows";
import { jobs } from "@virtool/data/db/schema/jobs";
import { legacySamples } from "@virtool/data/db/schema/samples";
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

vi.mock("@virtool/data/events/emit", () => ({
	createEmitter: vi.fn(),
	emit: vi.fn(),
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
	await db.delete(legacySamples);
	await db.delete(jobs);
	await db.delete(sessions);
	await db.delete(users);
	getRequest.mockReturnValue(
		new Request("https://virtool.test/_serverFn/test"),
	);
});

/** Authenticate the next call as a user with the given administrator role. */

async function seedSampleRow(
	overrides: Partial<typeof legacySamples.$inferInsert> = {},
): Promise<number> {
	return takeFirstOrThrow(
		await db
			.insert(legacySamples)
			.values({
				name: "Sample",
				library_type: "normal",
				created_at: new Date(),
				...overrides,
			})
			.returning({ id: legacySamples.id }),
	).id;
}

function call(name: string, data?: unknown) {
	return callServerFn(handlers, name, data);
}

describe("getSample", () => {
	it("returns 403 when the caller may not read the sample", async () => {
		const owner = await seedUser(db, { handle: "owner" });
		const sampleId = await seedSampleRow({ user_id: owner, all_read: false });

		await signIn(db, getRequest, { administratorRole: null });

		await expect(call("getSampleFn", { sampleId })).rejects.toBeInstanceOf(
			ForbiddenError,
		);
		expect(setResponseStatus).toHaveBeenCalledWith(403);
	});

	it("returns 404, not 403, for a sample that does not exist", async () => {
		await signIn(db, getRequest, { administratorRole: null });

		await expect(call("getSampleFn", { sampleId: 123456 })).rejects.toThrow();
		expect(setResponseStatus).toHaveBeenCalledWith(404);
		expect(setResponseStatus).not.toHaveBeenCalledWith(403);
	});

	it("returns the sample the owner may read", async () => {
		const userId = await signIn(db, getRequest, { administratorRole: null });
		const sampleId = await seedSampleRow({ user_id: userId });

		const sample = (await call("getSampleFn", { sampleId })) as { id: number };
		expect(sample.id).toBe(sampleId);
	});
});

describe("updateSampleRights", () => {
	it("returns 404 for a sample that does not exist", async () => {
		await signIn(db, getRequest, { administratorRole: "full" });

		await expect(
			call("updateSampleRightsFn", { sampleId: 123456, allRead: true }),
		).rejects.toThrow();
		expect(setResponseStatus).toHaveBeenCalledWith(404);
	});

	it("refuses a non-owner who is not a full administrator", async () => {
		const owner = await seedUser(db, { handle: "owner" });
		const sampleId = await seedSampleRow({ user_id: owner });

		await signIn(db, getRequest, { administratorRole: null });

		await expect(
			call("updateSampleRightsFn", { sampleId, allRead: true }),
		).rejects.toBeInstanceOf(ForbiddenError);
		expect(setResponseStatus).toHaveBeenCalledWith(403);
	});

	it("allows the sample owner", async () => {
		const userId = await signIn(db, getRequest, { administratorRole: null });
		const sampleId = await seedSampleRow({ user_id: userId });

		const sample = (await call("updateSampleRightsFn", {
			sampleId,
			allRead: true,
		})) as { allRead: boolean };
		expect(sample.allRead).toBe(true);
	});

	it("allows a full administrator who is not the owner", async () => {
		const owner = await seedUser(db, { handle: "owner" });
		const sampleId = await seedSampleRow({ user_id: owner });

		await signIn(db, getRequest, { administratorRole: "full" });

		const sample = (await call("updateSampleRightsFn", {
			sampleId,
			allWrite: true,
		})) as { allWrite: boolean };
		expect(sample.allWrite).toBe(true);
	});
});

describe("deleteSample", () => {
	it("refuses a caller without write rights", async () => {
		const owner = await seedUser(db, { handle: "owner" });
		const sampleId = await seedSampleRow({ user_id: owner, all_write: false });

		await signIn(db, getRequest, { administratorRole: null });

		await expect(call("deleteSampleFn", { sampleId })).rejects.toBeInstanceOf(
			ForbiddenError,
		);
		expect(setResponseStatus).toHaveBeenCalledWith(403);
	});

	it("returns 400 when an unfinished sample's job is still running", async () => {
		const userId = await signIn(db, getRequest, { administratorRole: null });

		const jobId = takeFirstOrThrow(
			await db
				.insert(jobs)
				.values({
					acquired: true,
					created_at: new Date(),
					state: "running",
					user_id: userId,
					workflow: "create_sample",
				})
				.returning({ id: jobs.id }),
		).id;

		const sampleId = await seedSampleRow({
			user_id: userId,
			ready: false,
			job_id: jobId,
		});

		await expect(call("deleteSampleFn", { sampleId })).rejects.toThrow();
		expect(setResponseStatus).toHaveBeenCalledWith(400);

		// The sample must survive the rejected delete.
		expect(
			await db
				.select()
				.from(legacySamples)
				.where(eq(legacySamples.id, sampleId)),
		).toHaveLength(1);
	});
});
