import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const deleteCookie = vi.fn();
const getCookie = vi.fn();
const getCookies = vi.fn();
const setCookie = vi.fn();

vi.mock("@tanstack/react-start/server", () => ({
	deleteCookie,
	getCookie,
	getCookies,
	setCookie,
}));

const {
	expireLegacySessionCookies,
	realCookies,
	SETUP_SESSION_ID_COOKIE,
	SETUP_SESSION_TOKEN_COOKIE,
} = await import("./cookies");

// The setup pair's, deliberately much shorter: a setup credential is finished
// with the moment its flow is.
const SETUP_MAX_AGE_SECONDS = 3_600;

beforeEach(() => {
	vi.clearAllMocks();
});

afterEach(() => {
	vi.unstubAllEnvs();
});

describe("realCookies", () => {
	it("reads the setup session cookies", () => {
		getCookie.mockReturnValue("setup_abc");

		expect(realCookies.getSetupSessionId()).toBe("setup_abc");
		expect(getCookie).toHaveBeenCalledWith(SETUP_SESSION_ID_COOKIE);

		expect(realCookies.getSetupSessionToken()).toBe("setup_abc");
		expect(getCookie).toHaveBeenCalledWith(SETUP_SESSION_TOKEN_COOKIE);
	});

	// Both halves together: a setup session is worthless without either, and
	// there is no flow that sets one alone.
	it("writes both setup cookies with the short max-age", () => {
		realCookies.setSetupSession("setup_abc", "token_abc");

		expect(setCookie).toHaveBeenNthCalledWith(
			1,
			SETUP_SESSION_ID_COOKIE,
			"setup_abc",
			{
				httpOnly: true,
				maxAge: SETUP_MAX_AGE_SECONDS,
				path: "/",
				sameSite: "lax",
				secure: false,
			},
		);
		expect(setCookie).toHaveBeenNthCalledWith(
			2,
			SETUP_SESSION_TOKEN_COOKIE,
			"token_abc",
			expect.objectContaining({ maxAge: SETUP_MAX_AGE_SECONDS }),
		);
	});

	it("marks the setup cookies secure in production", () => {
		vi.stubEnv("NODE_ENV", "production");

		realCookies.setSetupSession("setup_abc", "token_abc");

		expect(setCookie).toHaveBeenNthCalledWith(
			1,
			SETUP_SESSION_ID_COOKIE,
			"setup_abc",
			expect.objectContaining({ secure: true }),
		);
	});

	it("writes an explicitly extended setup max-age", () => {
		realCookies.setSetupSession("setup_abc", "token_abc", 72 * 60 * 60);

		expect(setCookie).toHaveBeenNthCalledWith(
			1,
			SETUP_SESSION_ID_COOKIE,
			"setup_abc",
			expect.objectContaining({ maxAge: 72 * 60 * 60 }),
		);
		expect(setCookie).toHaveBeenNthCalledWith(
			2,
			SETUP_SESSION_TOKEN_COOKIE,
			"token_abc",
			expect.objectContaining({ maxAge: 72 * 60 * 60 }),
		);
	});

	it("clears both setup cookies from the root path", () => {
		realCookies.clearSetup();

		expect(deleteCookie).toHaveBeenCalledTimes(2);
		expect(deleteCookie).toHaveBeenCalledWith(SETUP_SESSION_ID_COOKIE, {
			path: "/",
		});
		expect(deleteCookie).toHaveBeenCalledWith(SETUP_SESSION_TOKEN_COOKIE, {
			path: "/",
		});
	});
});

describe("expireLegacySessionCookies", () => {
	it("expires each legacy cookie the request carries with its attributes", () => {
		vi.stubEnv("NODE_ENV", "production");
		getCookies.mockReturnValue({
			session_id: "legacy",
			session_token: "legacy",
		});

		expireLegacySessionCookies();

		const attributes = {
			httpOnly: true,
			path: "/",
			sameSite: "lax",
			secure: true,
		};
		expect(deleteCookie).toHaveBeenCalledTimes(2);
		expect(deleteCookie).toHaveBeenCalledWith("session_id", attributes);
		expect(deleteCookie).toHaveBeenCalledWith("session_token", attributes);
	});

	it("expires only the legacy cookie that is present", () => {
		getCookies.mockReturnValue({ session_token: "legacy" });

		expireLegacySessionCookies();

		expect(deleteCookie).toHaveBeenCalledOnce();
		expect(deleteCookie).toHaveBeenCalledWith(
			"session_token",
			expect.objectContaining({ path: "/" }),
		);
	});

	it("leaves a request without legacy cookies alone", () => {
		getCookies.mockReturnValue({});

		expireLegacySessionCookies();

		expect(deleteCookie).not.toHaveBeenCalled();
		expect(setCookie).not.toHaveBeenCalled();
	});
});
