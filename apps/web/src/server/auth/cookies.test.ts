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

// The max-age set on both cookies. A mismatch would let the session id and
// session token cookies expire on different schedules.
const MAX_AGE_SECONDS = 2_600_000;

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
	it("reads the session id", () => {
		getCookie.mockReturnValue("session_abc");

		expect(realCookies.getSessionId()).toBe("session_abc");
		expect(getCookie).toHaveBeenCalledWith(SESSION_ID_COOKIE);
	});

	it("reads the session token", () => {
		getCookie.mockReturnValue("token_abc");

		expect(realCookies.getSessionToken()).toBe("token_abc");
		expect(getCookie).toHaveBeenCalledWith(SESSION_TOKEN_COOKIE);
	});

	it("returns undefined when a cookie is absent", () => {
		getCookie.mockReturnValue(undefined);

		expect(realCookies.getSessionId()).toBeUndefined();
		expect(realCookies.getSessionToken()).toBeUndefined();
	});

	it.each([
		["setSessionId", SESSION_ID_COOKIE],
		["setSessionToken", SESSION_TOKEN_COOKIE],
	] as const)("%s writes an http-only lax cookie", (method, name) => {
		realCookies[method]("value");

		expect(setCookie).toHaveBeenCalledWith(name, "value", {
			httpOnly: true,
			maxAge: MAX_AGE_SECONDS,
			path: "/",
			sameSite: "lax",
			secure: false,
		});
	});

	it("does not mark cookies secure outside production", () => {
		vi.stubEnv("NODE_ENV", "development");

		realCookies.setSessionId("session_abc");

		expect(setCookie).toHaveBeenCalledWith(
			SESSION_ID_COOKIE,
			"session_abc",
			expect.objectContaining({ secure: false }),
		);
	});

	it("marks cookies secure in production", () => {
		vi.stubEnv("NODE_ENV", "production");

		realCookies.setSessionId("session_abc");
		realCookies.setSessionToken("token_abc");

		expect(setCookie).toHaveBeenNthCalledWith(
			1,
			SESSION_ID_COOKIE,
			"session_abc",
			expect.objectContaining({ secure: true }),
		);
		expect(setCookie).toHaveBeenNthCalledWith(
			2,
			SESSION_TOKEN_COOKIE,
			"token_abc",
			expect.objectContaining({ secure: true }),
		);
	});

	it("clears both cookies from the root path", () => {
		realCookies.clear();

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
		realCookies.clear();

		expect(deleteCookie).not.toHaveBeenCalledWith(
			SETUP_SESSION_ID_COOKIE,
			expect.anything(),
		);
	});
});
