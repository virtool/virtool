import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const deleteCookie = vi.fn();
const getCookie = vi.fn();
const setCookie = vi.fn();

vi.mock("@tanstack/react-start/server", () => ({
	deleteCookie,
	getCookie,
	setCookie,
}));

const {
	realCookies,
	SESSION_ID_COOKIE,
	SESSION_TOKEN_COOKIE,
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
	it("writes a short-lived retained legacy session pair", () => {
		realCookies.setLegacySession("legacy-session", "legacy-token");

		expect(setCookie).toHaveBeenNthCalledWith(
			1,
			SESSION_ID_COOKIE,
			"legacy-session",
			expect.objectContaining({ maxAge: 3_600 }),
		);
		expect(setCookie).toHaveBeenNthCalledWith(
			2,
			SESSION_TOKEN_COOKIE,
			"legacy-token",
			expect.objectContaining({ maxAge: 3_600 }),
		);
	});

	it("writes a short-lived retained reset cookie pair", () => {
		realCookies.setLegacyResetSession("legacy-reset", "reset-token");

		expect(setCookie).toHaveBeenCalledWith(
			SESSION_ID_COOKIE,
			"legacy-reset",
			expect.objectContaining({ maxAge: 3_600 }),
		);
		expect(setCookie).toHaveBeenCalledWith(
			SESSION_TOKEN_COOKIE,
			"reset-token",
			expect.objectContaining({ maxAge: 3_600 }),
		);
	});

	it("clears both retained legacy cookies from the root path", () => {
		realCookies.clearLegacySession();

		expect(deleteCookie).toHaveBeenCalledTimes(2);
		expect(deleteCookie).toHaveBeenCalledWith(SESSION_ID_COOKIE, { path: "/" });
		expect(deleteCookie).toHaveBeenCalledWith(SESSION_TOKEN_COOKIE, {
			path: "/",
		});
	});

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

	// The two credentials must not be one rename away from clearing each other.
	it("does not touch the setup cookies when clearing the session pair", () => {
		realCookies.clearLegacySession();

		expect(deleteCookie).not.toHaveBeenCalledWith(
			SETUP_SESSION_ID_COOKIE,
			expect.anything(),
		);
	});
});
