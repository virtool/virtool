import type { Db } from "@virtool/data/db/pg";
import { sessions } from "@virtool/data/db/schema/sessions";
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

vi.mock("@sentry/tanstackstart-react", () => ({
	captureException: vi.fn(),
	setUser: vi.fn(),
}));

vi.mock("../logger", () => ({
	logger: { debug: vi.fn(), error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

// The middleware reads the `db` singleton at module scope. A getter defers the
// read until a check actually runs, by which point beforeAll has pointed it at
// this file's isolated database.
let db: Db;
vi.mock("../composition", () => ({
	client: {},
	get db() {
		return db;
	},
}));

const { watchForRevocation } = await import("./revocation");
const { seedSession, seedUser } = await import(
	"@virtool/data/auth/test/fixtures"
);
const { sessionCookie } = await import("../auth/test/fixtures");

// Short enough that a test does not wait on it, long enough not to hammer the
// database while a negative case proves nothing happened.
const INTERVAL = 20;

let database: TestDatabase;

beforeAll(async () => {
	database = await createTestDatabase();
	db = database.db;
}, 60_000);

afterAll(async () => {
	await database.drop();
});

beforeEach(async () => {
	await db.delete(sessions);
	await db.delete(users);
});

async function connectedRequest(): Promise<Request> {
	const userId = await seedUser(db);
	const { sessionId, token } = await seedSession(db, userId);

	return new Request("https://virtool.test/events", {
		headers: {
			cookie: sessionCookie({ sessionId, token }),
		},
	});
}

describe("watchForRevocation", () => {
	it("leaves a live session alone", async () => {
		const request = await connectedRequest();
		const onRevoked = vi.fn();

		const stop = watchForRevocation(request, INTERVAL, onRevoked);
		await new Promise((resolve) => setTimeout(resolve, INTERVAL * 5));
		stop();

		expect(onRevoked).not.toHaveBeenCalled();
	});

	it("reports a session that was deleted out from under the stream", async () => {
		const request = await connectedRequest();
		const onRevoked = vi.fn();

		const stop = watchForRevocation(request, INTERVAL, onRevoked);
		await db.delete(sessions);

		await vi.waitFor(() => expect(onRevoked).toHaveBeenCalled(), {
			timeout: 2000,
		});
		stop();
	});

	it("reports a user who was deactivated", async () => {
		const request = await connectedRequest();
		const onRevoked = vi.fn();

		const stop = watchForRevocation(request, INTERVAL, onRevoked);
		await db.update(users).set({ active: false });

		await vi.waitFor(() => expect(onRevoked).toHaveBeenCalled(), {
			timeout: 2000,
		});
		stop();
	});

	it("stops checking once it has reported, so a closing stream is told once", async () => {
		const request = await connectedRequest();
		const onRevoked = vi.fn();

		const stop = watchForRevocation(request, INTERVAL, onRevoked);
		await db.delete(sessions);

		await vi.waitFor(() => expect(onRevoked).toHaveBeenCalled(), {
			timeout: 2000,
		});
		await new Promise((resolve) => setTimeout(resolve, INTERVAL * 5));
		stop();

		expect(onRevoked).toHaveBeenCalledTimes(1);
	});

	it("stops checking when the stream closes first", async () => {
		const request = await connectedRequest();
		const onRevoked = vi.fn();

		const stop = watchForRevocation(request, INTERVAL, onRevoked);
		stop();

		await db.delete(sessions);
		await new Promise((resolve) => setTimeout(resolve, INTERVAL * 5));

		expect(onRevoked).not.toHaveBeenCalled();
	});
});
