import type { Db } from "@virtool/data/db/pg";
import { jobs } from "@virtool/data/db/schema/jobs";
import { sessions } from "@virtool/data/db/schema/sessions";
import { users } from "@virtool/data/db/schema/users";
import {
	createTestDatabase,
	type TestDatabase,
} from "@virtool/data/db/test/fixtures";
import { createJob } from "@virtool/data/jobs/data";
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

vi.mock("@tanstack/react-start/server", () => ({
	deleteCookie: vi.fn(),
	getCookie: vi.fn(),
	getRequest,
	setCookie: vi.fn(),
	setResponseStatus: vi.fn(),
}));

vi.mock("@sentry/tanstackstart-react", () => ({
	captureException: vi.fn(),
	setUser: vi.fn(),
}));

// The handlers read the `db` singleton at module scope. A getter defers the
// read until a handler actually runs, by which point beforeAll has pointed it
// at this file's isolated database.
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
	await db.delete(jobs);
	await db.delete(sessions);
	await db.delete(users);
});

function call(name: string, data?: unknown) {
	return callServerFn(handlers, name, data);
}

// `jobs.workflow` is a plain `text` column, so a row naming a workflow this
// build has never heard of is a row Postgres accepts. These pin what the SPA is
// served when one shows up: never the unknown value, because the client renders
// a workflow as a label and a link.
describe("workflow narrowing", () => {
	it("serves a job whose workflow it knows", async () => {
		const userId = await signIn(db, getRequest);
		const jobId = await createJob(db, "pathoscope", userId);

		const job = (await call("getJobFn", { jobId })) as { workflow: string };

		expect(job.workflow).toBe("pathoscope");
	});

	it("refuses a job naming a workflow it does not know", async () => {
		const userId = await signIn(db, getRequest);
		const jobId = await createJob(db, "transmogrify", userId);

		// Not a `ClientError`: the caller sent nothing wrong, so this is a 500 and
		// a Sentry event rather than routine control flow.
		await expect(call("getJobFn", { jobId })).rejects.toThrow(
			`job ${jobId} names a workflow this build does not know`,
		);
	});

	it("refuses a batch read carrying an unknown workflow", async () => {
		const userId = await signIn(db, getRequest);
		const known = await createJob(db, "nuvs", userId);
		const unknown = await createJob(db, "transmogrify", userId);

		await expect(
			call("getJobsFn", { jobIds: [known, unknown] }),
		).rejects.toThrow(/names a workflow this build does not know/);
	});

	it("refuses a search page carrying an unknown workflow", async () => {
		const userId = await signIn(db, getRequest);
		await createJob(db, "transmogrify", userId);

		await expect(
			call("findJobsFn", { page: 1, perPage: 25, states: [] }),
		).rejects.toThrow(/names a workflow this build does not know/);
	});
});
