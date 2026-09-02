import { randomBytes } from "node:crypto";
import {
	createKeyring,
	type EncryptedValue,
	type Keyring,
} from "@virtool/data/crypto/keyring";
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
let keyring: Keyring;
vi.mock("../composition", () => ({
	client: {},
	get db() {
		return db;
	},
	get keyring() {
		return keyring;
	},
}));

function encrypt(value: string): EncryptedValue {
	const result = masterKeyring.encrypt("resend_api_key", value);

	if (!result.ok) {
		throw new Error("expected ready keyring");
	}

	return result.value;
}

const activeKey = randomBytes(32).toString("base64");
const masterKeyring = createKeyring(activeKey, undefined);

const handlers = (await import(
	"./functions.ts?tss-serverfn-split"
)) as SplitServerFnModule;
const { ForbiddenError, UnauthorizedError } = await import(
	"../auth/middleware"
);
const { ClientError } = await import("../errors");
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
	vi.unstubAllGlobals();
	keyring = masterKeyring;
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

async function seedConfigured(): Promise<void> {
	await seedSettings(db, {
		emailApiKey: encrypt("re_secret"),
		emailSenderAddress: "noreply@virtool.example",
		emailSenderName: "Virtool",
	});
}

describe("authorization", () => {
	const calls: [string, unknown][] = [
		["getEmailSettingsFn", undefined],
		["updateEmailSettingsFn", { senderName: "Virtool" }],
		["setEmailApiKeyFn", { apiKey: "re_secret" }],
		["clearEmailApiKeyFn", undefined],
		["reencryptEmailApiKeyFn", undefined],
		["sendTestEmailFn", { recipient: "someone@example.com" }],
	];

	it.each(calls)("%s refuses an unauthenticated caller", async (name, data) => {
		await expect(call(name, data)).rejects.toBeInstanceOf(UnauthorizedError);
	});

	// Email configuration is recovery authority, so every administrator short of
	// a full one is refused, not only the ones without a settings role.
	const lesserRoles = ["settings", "users", "base", null] as const;

	it.each(
		lesserRoles.flatMap((role) =>
			calls.map(([name, data]) => [role, name, data] as const),
		),
	)("%s administrator is refused by %s", async (role, name, data) => {
		await signIn(db, getRequest, { administratorRole: role });
		await expect(call(name, data)).rejects.toBeInstanceOf(ForbiddenError);
	});
});

describe("getEmailSettingsFn", () => {
	it("returns masked state with availability and never any key material", async () => {
		await signIn(db, getRequest, { administratorRole: "full" });
		await seedConfigured();

		const published = await call("getEmailSettingsFn");

		expect(published).toEqual({
			availability: "disabled",
			enabled: false,
			hasApiKey: true,
			replyToAddress: "",
			senderAddress: "noreply@virtool.example",
			senderName: "Virtool",
		});
		expect(JSON.stringify(published)).not.toContain("re_secret");
	});

	it("reports a configuration error when the encryption key cannot decrypt", async () => {
		await signIn(db, getRequest, { administratorRole: "full" });
		await seedConfigured();

		keyring = createKeyring(undefined, undefined);

		await expect(call("getEmailSettingsFn")).resolves.toMatchObject({
			availability: "configuration_error",
			hasApiKey: true,
		});
	});
});

describe("updateEmailSettingsFn", () => {
	it("normalizes and stores delivery fields", async () => {
		await signIn(db, getRequest, { administratorRole: "full" });
		await seedSettings(db);

		await expect(
			call("updateEmailSettingsFn", {
				senderAddress: "  noreply@virtool.example  ",
				senderName: "  Virtool  ",
				replyToAddress: "support@virtool.example",
			}),
		).resolves.toMatchObject({
			senderAddress: "noreply@virtool.example",
			senderName: "Virtool",
			replyToAddress: "support@virtool.example",
		});
	});

	it("rejects a malformed sender address", async () => {
		await signIn(db, getRequest, { administratorRole: "full" });

		await expect(
			call("updateEmailSettingsFn", { senderAddress: "not-an-address" }),
		).rejects.toThrow();
	});

	it("rejects a sender name holding a control character", async () => {
		await signIn(db, getRequest, { administratorRole: "full" });

		await expect(
			call("updateEmailSettingsFn", { senderName: "Virtool\nX" }),
		).rejects.toThrow();
	});

	it("accepts a sender name holding a comma", async () => {
		await signIn(db, getRequest, { administratorRole: "full" });
		await seedSettings(db);

		await expect(
			call("updateEmailSettingsFn", { senderName: "Virtool, Inc." }),
		).resolves.toMatchObject({ senderName: "Virtool, Inc." });
	});

	it("refuses to enable an unconfigured instance", async () => {
		await signIn(db, getRequest, { administratorRole: "full" });
		await seedSettings(db);

		await expect(
			call("updateEmailSettingsFn", { enabled: true }),
		).rejects.toBeInstanceOf(ClientError);
		expect(setResponseStatus).toHaveBeenCalledWith(400);
	});

	it("enables a configured instance and disabling preserves the key", async () => {
		await signIn(db, getRequest, { administratorRole: "full" });
		await seedConfigured();

		await expect(
			call("updateEmailSettingsFn", { enabled: true }),
		).resolves.toMatchObject({ enabled: true, availability: "ready" });

		await expect(
			call("updateEmailSettingsFn", { enabled: false }),
		).resolves.toMatchObject({
			enabled: false,
			hasApiKey: true,
			availability: "disabled",
		});
	});
});

describe("setEmailApiKeyFn and clearEmailApiKeyFn", () => {
	it("stores the key encrypted and reports only a flag", async () => {
		await signIn(db, getRequest, { administratorRole: "full" });
		await seedSettings(db);

		const published = await call("setEmailApiKeyFn", {
			apiKey: "  re_secret  ",
		});

		expect(published).toMatchObject({ hasApiKey: true });
		expect(JSON.stringify(published)).not.toContain("re_secret");

		const [row] = await db.select().from(settings);

		expect(row?.emailApiKey).not.toBeNull();
		expect(JSON.stringify(row?.emailApiKey)).not.toContain("re_secret");
	});

	it("refuses to store a key without an encryption key configured", async () => {
		await signIn(db, getRequest, { administratorRole: "full" });
		await seedSettings(db);

		keyring = createKeyring(undefined, undefined);

		await expect(
			call("setEmailApiKeyFn", { apiKey: "re_secret" }),
		).rejects.toBeInstanceOf(ClientError);
		expect(setResponseStatus).toHaveBeenCalledWith(400);
	});

	it("clearing removes the key and disables delivery", async () => {
		await signIn(db, getRequest, { administratorRole: "full" });
		await seedConfigured();
		await call("updateEmailSettingsFn", { enabled: true });

		await expect(call("clearEmailApiKeyFn")).resolves.toMatchObject({
			enabled: false,
			hasApiKey: false,
			availability: "unconfigured",
		});
	});
});

describe("reencryptEmailApiKeyFn", () => {
	it("reports already_current for an envelope under the active key", async () => {
		await signIn(db, getRequest, { administratorRole: "full" });
		await seedConfigured();

		await expect(call("reencryptEmailApiKeyFn")).resolves.toBe(
			"already_current",
		);
	});

	it("re-encrypts an envelope written under the previous key", async () => {
		await signIn(db, getRequest, { administratorRole: "full" });

		await seedConfigured();

		keyring = createKeyring(randomBytes(32).toString("base64"), activeKey);

		await expect(call("reencryptEmailApiKeyFn")).resolves.toBe("reencrypted");
		await expect(call("getEmailSettingsFn")).resolves.toMatchObject({
			availability: "disabled",
		});
	});
});

describe("sendTestEmailFn", () => {
	it("sends the test template and reports success", async () => {
		await signIn(db, getRequest, { administratorRole: "full" });
		await seedConfigured();

		const fetchMock = vi.fn().mockResolvedValue(
			new Response(JSON.stringify({ id: "msg_1" }), {
				status: 200,
				headers: { "content-type": "application/json" },
			}),
		);
		vi.stubGlobal("fetch", fetchMock);

		await expect(
			call("sendTestEmailFn", { recipient: "someone@example.com" }),
		).resolves.toEqual({ ok: true, providerMessageId: "msg_1" });

		const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
		const body = JSON.parse(init.body as string);

		expect(body.to).toEqual(["someone@example.com"]);
		expect(body.from).toBe("Virtool <noreply@virtool.example>");
	});

	it("reports unavailable without sending when unconfigured", async () => {
		await signIn(db, getRequest, { administratorRole: "full" });
		await seedSettings(db);

		const fetchMock = vi.fn();
		vi.stubGlobal("fetch", fetchMock);

		await expect(
			call("sendTestEmailFn", { recipient: "someone@example.com" }),
		).resolves.toEqual({ ok: false, code: "unavailable" });
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("reports a bounded code and no provider text when Resend refuses", async () => {
		await signIn(db, getRequest, { administratorRole: "full" });
		await seedConfigured();

		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue(
				new Response(
					JSON.stringify({
						name: "validation_error",
						message: "The virtool.example domain is not verified",
						statusCode: 422,
					}),
					{ status: 422, headers: { "content-type": "application/json" } },
				),
			),
		);

		await expect(
			call("sendTestEmailFn", { recipient: "someone@example.com" }),
		).resolves.toEqual({ ok: false, code: "invalid_request" });
	});

	it("reports an authentication failure when the provider rejects the key", async () => {
		await signIn(db, getRequest, { administratorRole: "full" });
		await seedConfigured();

		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue(
				new Response(
					JSON.stringify({
						name: "invalid_api_key",
						message: "API key is invalid",
						statusCode: 401,
					}),
					{ status: 401, headers: { "content-type": "application/json" } },
				),
			),
		);

		await expect(
			call("sendTestEmailFn", { recipient: "someone@example.com" }),
		).resolves.toEqual({ ok: false, code: "authentication" });
	});

	it("rejects a malformed recipient", async () => {
		await signIn(db, getRequest, { administratorRole: "full" });

		await expect(
			call("sendTestEmailFn", { recipient: "nope" }),
		).rejects.toThrow();
	});

	it("does not enable delivery", async () => {
		await signIn(db, getRequest, { administratorRole: "full" });
		await seedConfigured();

		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue(
				new Response(JSON.stringify({ id: "msg_1" }), {
					status: 200,
					headers: { "content-type": "application/json" },
				}),
			),
		);

		await call("sendTestEmailFn", { recipient: "someone@example.com" });

		await expect(call("getEmailSettingsFn")).resolves.toMatchObject({
			enabled: false,
		});
	});
});
