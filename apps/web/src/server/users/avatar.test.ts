import type { Db } from "@virtool/data/db/pg";
import { authSessions } from "@virtool/data/db/schema/auth";
import { users } from "@virtool/data/db/schema/users";
import {
	createTestDatabase,
	type TestDatabase,
} from "@virtool/data/db/test/fixtures";
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

vi.mock("@tanstack/react-start/server", () => ({
	deleteCookie: vi.fn(),
	getCookie: vi.fn(),
	getRequest: vi.fn(),
	setCookie: vi.fn(),
	setResponseStatus: vi.fn(),
}));

vi.mock("@sentry/tanstackstart-react", () => ({
	captureException: vi.fn(),
	setUser: vi.fn(),
	setContext: vi.fn(),
}));

let db: Db;
vi.mock("../composition", () => ({
	client: {},
	get db() {
		return db;
	},
}));

const { handleAvatar } = await import("./avatar");
const { seedSession, seedUser } = await import(
	"@virtool/data/auth/test/fixtures"
);
const { sessionCookie } = await import("../auth/test/fixtures");

const fetchMock = vi.fn<typeof fetch>();

let database: TestDatabase;
let viewerId: number;

beforeAll(async () => {
	database = await createTestDatabase();
	db = database.db;
}, 60_000);

afterAll(async () => {
	await database.drop();
});

beforeEach(async () => {
	fetchMock.mockReset();
	vi.stubGlobal("fetch", fetchMock);
	await db.delete(authSessions);
	await db.delete(users);

	viewerId = await seedUser(db, { handle: "viewer" });
});

afterEach(() => {
	vi.unstubAllGlobals();
});

async function seedGravatarUser(avatarSource = "gravatar"): Promise<void> {
	await seedUser(db, {
		email: "alice@example.com",
		handle: "alice",
		settings: { avatar_source: avatarSource },
	});
}

async function request(
	headers: Record<string, string> = {},
	signedIn = true,
): Promise<Request> {
	if (signedIn) {
		const { sessionId, token } = await seedSession(db, viewerId);
		headers.cookie = sessionCookie({ sessionId, token });
	}

	return new Request("https://virtool.test/avatars/alice", { headers });
}

function gravatarResponse(): Response {
	return new Response("png", { headers: { "content-type": "image/png" } });
}

describe("handleAvatar", () => {
	it("rejects a request without a session", async () => {
		const response = await handleAvatar(await request({}, false), "alice");

		expect(response.status).toBe(401);
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("proxies the Gravatar image for the email hash", async () => {
		await seedGravatarUser();
		fetchMock.mockResolvedValue(gravatarResponse());

		const response = await handleAvatar(await request(), "alice");

		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toBe("image/png");
		expect(response.headers.get("etag")).toBeTruthy();
		expect(await response.text()).toBe("png");
		expect(String(fetchMock.mock.calls[0]?.[0])).toBe(
			"https://gravatar.com/avatar/ff8d9819fc0e12bf0d24892e45987e249a28dce836a85cad60e28eaaa8c6d976?s=120&d=identicon",
		);
	});

	it("answers 304 without asking Gravatar when the ETag matches", async () => {
		await seedGravatarUser();
		fetchMock.mockResolvedValue(gravatarResponse());

		const first = await handleAvatar(await request(), "alice");
		const etag = first.headers.get("etag") ?? "";

		const second = await handleAvatar(
			await request({ "if-none-match": etag }),
			"alice",
		);

		expect(second.status).toBe(304);
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it("answers 404 when the user did not choose Gravatar", async () => {
		await seedGravatarUser("initials");

		const response = await handleAvatar(await request(), "alice");

		expect(response.status).toBe(404);
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("answers 502 when Gravatar does not return an image", async () => {
		await seedGravatarUser();
		fetchMock.mockResolvedValue(new Response("down", { status: 500 }));

		const response = await handleAvatar(await request(), "alice");

		expect(response.status).toBe(502);
	});
});
