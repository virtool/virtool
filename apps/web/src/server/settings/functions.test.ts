import type { Db } from "@virtool/data/db/pg";
import { sessions } from "@virtool/data/db/schema/sessions";
import { settings } from "@virtool/data/db/schema/settings";
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
const { ForbiddenError, UnauthorizedError } = await import(
	"../auth/middleware"
);
const { signIn } = await import("../auth/test/fixtures");
const { seedSettings } = await import("@virtool/data/settings/test/fixtures");

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
	await db.delete(settings);
	await db.delete(users);
	getRequest.mockReturnValue(
		new Request("https://virtool.test/_serverFn/test"),
	);
});

function call(name: string, data?: unknown) {
	return callServerFn(handlers, name, data);
}

describe("getSettings", () => {
	it("refuses an unauthenticated caller", async () => {
		await expect(call("getSettingsFn")).rejects.toBeInstanceOf(
			UnauthorizedError,
		);
	});

	it("refuses a caller without the settings role", async () => {
		await signIn(db, getRequest, { administratorRole: "base" });
		await expect(call("getSettingsFn")).rejects.toBeInstanceOf(ForbiddenError);
	});

	it("returns the settings for a settings administrator", async () => {
		await signIn(db, getRequest, { administratorRole: "settings" });
		await seedSettings(db, {
			defaultSourceTypes: ["genotype"],
			enableSentry: false,
			minimumPasswordLength: 12,
			sampleGroup: "force_choice",
		});

		await expect(call("getSettingsFn")).resolves.toMatchObject({
			defaultSourceTypes: ["genotype"],
			enableSentry: false,
			minimumPasswordLength: 12,
			sampleGroup: "force_choice",
		});
	});

	it("reports the NCBI API key as a flag and never sends the key", async () => {
		await signIn(db, getRequest, { administratorRole: "settings" });
		await seedSettings(db, { ncbiApiKey: "secret-key" });

		const published = await call("getSettingsFn");

		expect(published).toMatchObject({ hasNcbiApiKey: true });
		expect(published).not.toHaveProperty("ncbiApiKey");
		expect(JSON.stringify(published)).not.toContain("secret-key");
	});

	it("reports no NCBI API key when the stored one is empty", async () => {
		await signIn(db, getRequest, { administratorRole: "settings" });
		await seedSettings(db, { ncbiApiKey: "" });

		await expect(call("getSettingsFn")).resolves.toMatchObject({
			hasNcbiApiKey: false,
		});
	});
});

describe("updateSettings", () => {
	it("refuses an unauthenticated caller", async () => {
		await expect(
			call("updateSettingsFn", { enableSentry: false }),
		).rejects.toBeInstanceOf(UnauthorizedError);
	});

	it("refuses a caller without the settings role", async () => {
		await signIn(db, getRequest, { administratorRole: "base" });
		await expect(
			call("updateSettingsFn", { enableSentry: false }),
		).rejects.toBeInstanceOf(ForbiddenError);
	});

	it("applies the patch and returns the updated settings", async () => {
		await signIn(db, getRequest, { administratorRole: "settings" });
		await seedSettings(db, { enableSentry: true });

		await expect(
			call("updateSettingsFn", {
				enableSentry: false,
				defaultSourceTypes: ["strain"],
			}),
		).resolves.toMatchObject({
			enableSentry: false,
			defaultSourceTypes: ["strain"],
		});

		const [row] = await db.select().from(settings);
		expect(row).toMatchObject({
			enableSentry: false,
			defaultSourceTypes: ["strain"],
		});
	});

	it("rejects an invalid sample group", async () => {
		await signIn(db, getRequest, { administratorRole: "settings" });
		await expect(
			call("updateSettingsFn", { sampleGroup: "everyone" }),
		).rejects.toThrow();
	});

	it("rejects an empty patch", async () => {
		await signIn(db, getRequest, { administratorRole: "settings" });
		await expect(call("updateSettingsFn", {})).rejects.toThrow();
	});

	it("stores an NCBI API key without echoing it back", async () => {
		await signIn(db, getRequest, { administratorRole: "settings" });
		await seedSettings(db);

		const published = await call("updateSettingsFn", {
			ncbiApiKey: "  secret-key  ",
		});

		expect(published).toMatchObject({ hasNcbiApiKey: true });
		expect(JSON.stringify(published)).not.toContain("secret-key");

		const [row] = await db.select().from(settings);
		expect(row).toMatchObject({ ncbiApiKey: "secret-key" });
	});

	it("clears the NCBI API key when given an empty string", async () => {
		await signIn(db, getRequest, { administratorRole: "settings" });
		await seedSettings(db, { ncbiApiKey: "secret-key" });

		await expect(
			call("updateSettingsFn", { ncbiApiKey: "" }),
		).resolves.toMatchObject({ hasNcbiApiKey: false });

		const [row] = await db.select().from(settings);
		expect(row).toMatchObject({ ncbiApiKey: "" });
	});

	it("rejects an NCBI API key longer than the column should hold", async () => {
		await signIn(db, getRequest, { administratorRole: "settings" });
		await expect(
			call("updateSettingsFn", { ncbiApiKey: "a".repeat(129) }),
		).rejects.toThrow();
	});
});
