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

function key(): string {
	return randomBytes(32).toString("base64");
}

const activeKey = key();

/*
 Reassigned by the tests that need a keyring other than the one the credential
 was written under. The mock reads it on every access, so a test can swap the
 process keyring the way redeploying with a different `VT_ENCRYPTION_KEY`
 would.
*/
let keyring: Keyring = createKeyring(activeKey, undefined);

let db: Db;
vi.mock("../composition", () => ({
	client: {},
	get db() {
		return db;
	},
	get keyring() {
		return keyring;
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

function encryptNcbiApiKey(plaintext: string): EncryptedValue {
	const result = keyring.encrypt("ncbi_api_key", plaintext);

	if (!result.ok) {
		throw new Error("expected ready keyring");
	}

	return result.value;
}

beforeEach(async () => {
	vi.clearAllMocks();
	keyring = createKeyring(activeKey, undefined);
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

/** The stored envelope, which every NCBI assertion below has to read back. */
async function storedNcbiApiKey(): Promise<EncryptedValue | null> {
	const [row] = await db.select().from(settings);

	if (!row) {
		throw new Error("expected a settings row");
	}

	return row.ncbiApiKey;
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
		const envelope = encryptNcbiApiKey("secret-key");
		await seedSettings(db, { ncbiApiKey: envelope });

		const published = await call("getSettingsFn");

		expect(published).toMatchObject({
			hasNcbiApiKey: true,
			ncbiAvailability: "ready",
		});
		expect(published).not.toHaveProperty("ncbiApiKey");
		expect(JSON.stringify(published)).not.toContain("secret-key");
		expect(JSON.stringify(published)).not.toContain(envelope.ciphertext);
	});

	it("never sends the email columns to a settings administrator", async () => {
		await signIn(db, getRequest, { administratorRole: "settings" });
		await seedSettings(db, {
			emailApiKey: {
				version: 1,
				algorithm: "aes-256-gcm",
				purpose: "resend_api_key",
				keyId: "abcdef0123456789",
				nonce: "AAAAAAAAAAAAAAAA",
				ciphertext: "c2VjcmV0LWNpcGhlcnRleHQ=",
				tag: "AAAAAAAAAAAAAAAAAAAAAA==",
			},
			emailSenderAddress: "noreply@virtool.example",
		});

		const published = await call("getSettingsFn");

		expect(published).not.toHaveProperty("emailApiKey");
		expect(published).not.toHaveProperty("emailEnabled");
		expect(published).not.toHaveProperty("emailSenderAddress");
		expect(JSON.stringify(published)).not.toContain("ciphertext");
	});

	it("reports no NCBI API key when none is stored", async () => {
		await signIn(db, getRequest, { administratorRole: "settings" });
		await seedSettings(db, { ncbiApiKey: null });

		await expect(call("getSettingsFn")).resolves.toMatchObject({
			hasNcbiApiKey: false,
			ncbiAvailability: "unconfigured",
		});
	});

	// A key written under an encryption key this process no longer holds is
	// still a stored key. The flag says so and the availability says why it
	// cannot be used, which is what separates a rotation mistake from a missing
	// key in the administration view.
	it("reports a configuration error when the stored key will not decrypt", async () => {
		await signIn(db, getRequest, { administratorRole: "settings" });
		await seedSettings(db, { ncbiApiKey: encryptNcbiApiKey("secret-key") });

		keyring = createKeyring(key(), undefined);

		await expect(call("getSettingsFn")).resolves.toMatchObject({
			hasNcbiApiKey: true,
			ncbiAvailability: "configuration_error",
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

	// The credential moved to its own function when it became an envelope. A
	// patch carrying it would have to reach the keyring, and a settings patch
	// has none.
	it("ignores an NCBI API key in the patch", async () => {
		await signIn(db, getRequest, { administratorRole: "settings" });
		await seedSettings(db);

		await expect(
			call("updateSettingsFn", { ncbiApiKey: "secret-key" }),
		).rejects.toThrow();

		expect(await storedNcbiApiKey()).toBeNull();
	});
});

describe("setNcbiApiKey", () => {
	it("refuses an unauthenticated caller", async () => {
		await expect(
			call("setNcbiApiKeyFn", { apiKey: "secret-key" }),
		).rejects.toBeInstanceOf(UnauthorizedError);
	});

	it("refuses a caller without the settings role", async () => {
		await signIn(db, getRequest, { administratorRole: "base" });
		await expect(
			call("setNcbiApiKeyFn", { apiKey: "secret-key" }),
		).rejects.toBeInstanceOf(ForbiddenError);
	});

	it("stores the key encrypted without echoing it back", async () => {
		await signIn(db, getRequest, { administratorRole: "settings" });
		await seedSettings(db);

		const published = await call("setNcbiApiKeyFn", {
			apiKey: "  secret-key  ",
		});

		expect(published).toMatchObject({
			hasNcbiApiKey: true,
			ncbiAvailability: "ready",
		});
		expect(JSON.stringify(published)).not.toContain("secret-key");

		const stored = await storedNcbiApiKey();

		if (stored === null) {
			throw new Error("expected a stored envelope");
		}

		// The trim is what makes a pasted key with trailing whitespace the key
		// itself, and it can only be checked through a decryption.
		expect(JSON.stringify(stored)).not.toContain("secret-key");
		expect(keyring.decrypt("ncbi_api_key", stored)).toEqual({
			ok: true,
			plaintext: "secret-key",
		});
	});

	it("replaces a stored key", async () => {
		await signIn(db, getRequest, { administratorRole: "settings" });
		await seedSettings(db, { ncbiApiKey: encryptNcbiApiKey("old-key") });

		await call("setNcbiApiKeyFn", { apiKey: "new-key" });

		const stored = await storedNcbiApiKey();

		if (stored === null) {
			throw new Error("expected a stored envelope");
		}

		expect(keyring.decrypt("ncbi_api_key", stored)).toEqual({
			ok: true,
			plaintext: "new-key",
		});
	});

	it("refuses an empty key", async () => {
		await signIn(db, getRequest, { administratorRole: "settings" });
		await expect(call("setNcbiApiKeyFn", { apiKey: "" })).rejects.toThrow();
	});

	it("refuses a key longer than the column should hold", async () => {
		await signIn(db, getRequest, { administratorRole: "settings" });
		await expect(
			call("setNcbiApiKeyFn", { apiKey: "a".repeat(129) }),
		).rejects.toThrow();
	});

	it("refuses to store a key with no encryption key configured", async () => {
		await signIn(db, getRequest, { administratorRole: "settings" });
		await seedSettings(db);

		keyring = createKeyring(undefined, undefined);

		await expect(
			call("setNcbiApiKeyFn", { apiKey: "secret-key" }),
		).rejects.toThrow();

		expect(await storedNcbiApiKey()).toBeNull();
	});
});

describe("clearNcbiApiKey", () => {
	it("refuses a caller without the settings role", async () => {
		await signIn(db, getRequest, { administratorRole: "base" });
		await expect(call("clearNcbiApiKeyFn")).rejects.toBeInstanceOf(
			ForbiddenError,
		);
	});

	it("removes the stored key", async () => {
		await signIn(db, getRequest, { administratorRole: "settings" });
		await seedSettings(db, { ncbiApiKey: encryptNcbiApiKey("secret-key") });

		await expect(call("clearNcbiApiKeyFn")).resolves.toMatchObject({
			hasNcbiApiKey: false,
			ncbiAvailability: "unconfigured",
		});

		expect(await storedNcbiApiKey()).toBeNull();
	});

	// Removing a key that cannot be read is the way out of a lost encryption
	// key, so it must not depend on decrypting the value first.
	it("removes a key that will not decrypt", async () => {
		await signIn(db, getRequest, { administratorRole: "settings" });
		await seedSettings(db, { ncbiApiKey: encryptNcbiApiKey("secret-key") });

		keyring = createKeyring(key(), undefined);

		await expect(call("clearNcbiApiKeyFn")).resolves.toMatchObject({
			hasNcbiApiKey: false,
		});
	});
});
