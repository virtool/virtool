import { userServerFnMocks } from "@tests/server-fn/users";
import {
	FORBIDDEN_ERROR_NAME,
	MFA_ENROLLMENT_REQUIRED_ERROR_NAME,
	SESSION_NOT_FRESH_ERROR_NAME,
	SETUP_REQUIRED_ERROR_NAME,
	UNAUTHORIZED_ERROR_NAME,
} from "@virtool/contracts";
import { beforeEach, describe, expect, it, vi } from "vitest";

const assign = vi.fn();

function setLocation(pathname: string, search = "") {
	Object.defineProperty(window, "location", {
		configurable: true,
		value: { assign, pathname, search },
	});
}

function namedError(name: string, purpose?: string): Error {
	return Object.assign(new Error(name), { name, purpose });
}

// `armed` and `ended` are module state, so every test needs a fresh copy.
async function loadSession() {
	vi.resetModules();
	return import("../session");
}

function rejectAccount(name: string, purpose?: string) {
	userServerFnMocks.getAccountFn.mockRejectedValue(namedError(name, purpose));
}

const LOGIN_URL =
	"/login?reason=session-ended&redirect=%2Fsamples%3Ffind%3Dfoo";

beforeEach(() => {
	assign.mockClear();
	userServerFnMocks.getAccountFn.mockReset();
	window.sessionStorage.clear();
	setLocation("/samples", "?find=foo");
});

describe("endSession", () => {
	it("does nothing until an authenticated load has armed it", async () => {
		const { endSession } = await loadSession();

		await expect(endSession()).resolves.toBe(false);

		expect(userServerFnMocks.getAccountFn).not.toHaveBeenCalled();
		expect(assign).not.toHaveBeenCalled();
	});

	it("sends the user to the login wall with a reason and a way back", async () => {
		const { armSessionEnd, endSession } = await loadSession();
		rejectAccount(UNAUTHORIZED_ERROR_NAME);

		armSessionEnd();

		await expect(endSession()).resolves.toBe(true);
		expect(assign).toHaveBeenCalledWith(LOGIN_URL);
	});

	it("stays when the current cookie is still accepted", async () => {
		const { armSessionEnd, endSession } = await loadSession();
		userServerFnMocks.getAccountFn.mockResolvedValue({});
		window.sessionStorage.setItem("draft", "unsaved");

		armSessionEnd();

		await expect(endSession()).resolves.toBe(false);
		expect(assign).not.toHaveBeenCalled();
		expect(window.sessionStorage.getItem("draft")).toBe("unsaved");
	});

	it("stays when the check fails, and asks again next time", async () => {
		const { armSessionEnd, endSession } = await loadSession();
		rejectAccount(UNAUTHORIZED_ERROR_NAME);
		userServerFnMocks.getAccountFn.mockRejectedValueOnce(
			new TypeError("Failed to fetch"),
		);

		armSessionEnd();

		await expect(endSession()).resolves.toBe(false);
		expect(assign).not.toHaveBeenCalled();

		await expect(endSession()).resolves.toBe(true);
		expect(assign).toHaveBeenCalledTimes(1);
	});

	it("clears session storage so no draft outlives the session", async () => {
		const { armSessionEnd, endSession } = await loadSession();
		rejectAccount(UNAUTHORIZED_ERROR_NAME);
		window.sessionStorage.setItem("draft", "unsaved");

		armSessionEnd();
		await endSession();

		expect(window.sessionStorage.getItem("draft")).toBeNull();
	});

	it("does not point the login wall back at itself", async () => {
		const { armSessionEnd, endSession } = await loadSession();
		rejectAccount(UNAUTHORIZED_ERROR_NAME);
		setLocation("/login");

		armSessionEnd();
		await endSession();

		expect(assign).toHaveBeenCalledWith("/login?reason=session-ended");
	});

	it("asks and leaves once, however many 401s arrive", async () => {
		const { armSessionEnd, endSession } = await loadSession();
		rejectAccount(UNAUTHORIZED_ERROR_NAME);

		armSessionEnd();
		await Promise.all([endSession(), endSession()]);
		await endSession();

		expect(userServerFnMocks.getAccountFn).toHaveBeenCalledTimes(1);
		expect(assign).toHaveBeenCalledTimes(1);
	});

	it.each([
		[MFA_ENROLLMENT_REQUIRED_ERROR_NAME, undefined, "/mfa-enrollment"],
		[SETUP_REQUIRED_ERROR_NAME, "email_remediation", "/email-remediation"],
	])("sends %s to its wall", async (name, purpose, path) => {
		const { armSessionEnd, endSession } = await loadSession();
		rejectAccount(name, purpose);

		armSessionEnd();

		await expect(endSession()).resolves.toBe(true);
		expect(assign).toHaveBeenCalledTimes(1);
		expect(assign).toHaveBeenCalledWith(
			`${path}?redirect=%2Fsamples%3Ffind%3Dfoo`,
		);
	});

	it("keeps drafts for MFA enrollment, because the session continues", async () => {
		const { armSessionEnd, endSession } = await loadSession();
		rejectAccount(MFA_ENROLLMENT_REQUIRED_ERROR_NAME);
		window.sessionStorage.setItem("draft", "unsaved");

		armSessionEnd();
		await endSession();

		expect(window.sessionStorage.getItem("draft")).toBe("unsaved");
	});

	it("clears drafts for email remediation, because the session is gone", async () => {
		const { armSessionEnd, endSession } = await loadSession();
		rejectAccount(SETUP_REQUIRED_ERROR_NAME, "email_remediation");
		window.sessionStorage.setItem("draft", "unsaved");

		armSessionEnd();
		await endSession();

		expect(window.sessionStorage.getItem("draft")).toBeNull();
	});

	it("does not leave the wall that the restriction calls for", async () => {
		const { armSessionEnd, endSession } = await loadSession();
		rejectAccount(MFA_ENROLLMENT_REQUIRED_ERROR_NAME);
		setLocation("/mfa-enrollment");

		armSessionEnd();
		await endSession();

		expect(assign).not.toHaveBeenCalled();
	});
});

describe("followAuthError", () => {
	it("confirms an error about the principal", async () => {
		const { armSessionEnd, followAuthError } = await loadSession();
		rejectAccount(MFA_ENROLLMENT_REQUIRED_ERROR_NAME);

		armSessionEnd();

		expect(
			followAuthError(namedError(MFA_ENROLLMENT_REQUIRED_ERROR_NAME)),
		).toBe(true);
		await vi.waitFor(() => expect(assign).toHaveBeenCalledTimes(1));
	});

	it.each([
		[namedError(FORBIDDEN_ERROR_NAME)],
		[namedError(SESSION_NOT_FRESH_ERROR_NAME)],
		[new Error("network down")],
	])("leaves the session alone for %s", async (error) => {
		const { armSessionEnd, followAuthError } = await loadSession();

		armSessionEnd();

		expect(followAuthError(error)).toBe(false);
		expect(userServerFnMocks.getAccountFn).not.toHaveBeenCalled();
	});
});

describe("holdSessionEnd", () => {
	async function endDuringRotation() {
		const { armSessionEnd, endSession, holdSessionEnd } = await loadSession();
		const rotation = Promise.withResolvers<string>();

		armSessionEnd();
		const held = holdSessionEnd(() => rotation.promise);
		const ending = await endSession();

		return { ending, held, rotation };
	}

	it("keeps the page in place while the rotation is in flight", async () => {
		const { ending } = await endDuringRotation();

		expect(ending).toBe(false);
		expect(userServerFnMocks.getAccountFn).not.toHaveBeenCalled();
		expect(assign).not.toHaveBeenCalled();
	});

	it("stays when the rotated session is live", async () => {
		userServerFnMocks.getAccountFn.mockResolvedValue({});
		const { held, rotation } = await endDuringRotation();

		rotation.resolve("rotated");

		await expect(held).resolves.toBe("rotated");
		await vi.waitFor(() =>
			expect(userServerFnMocks.getAccountFn).toHaveBeenCalledTimes(1),
		);
		expect(assign).not.toHaveBeenCalled();
	});

	it("ends the session when it is gone after the rotation", async () => {
		rejectAccount(UNAUTHORIZED_ERROR_NAME);
		const { held, rotation } = await endDuringRotation();
		const failure = new Error("challenge failed");

		rotation.reject(failure);

		await expect(held).rejects.toBe(failure);
		await vi.waitFor(() => expect(assign).toHaveBeenCalledWith(LOGIN_URL));
	});

	it("does not confirm when nothing tried to end the session", async () => {
		const { armSessionEnd, holdSessionEnd } = await loadSession();

		armSessionEnd();
		await holdSessionEnd(async () => "rotated");

		expect(userServerFnMocks.getAccountFn).not.toHaveBeenCalled();
	});

	it("discards an answer that a new rotation made stale", async () => {
		const { armSessionEnd, endSession, holdSessionEnd } = await loadSession();
		const answer = Promise.withResolvers<never>();
		const rotation = Promise.withResolvers<void>();
		userServerFnMocks.getAccountFn.mockReturnValueOnce(answer.promise);
		userServerFnMocks.getAccountFn.mockResolvedValue({});

		armSessionEnd();
		const ending = endSession();
		await vi.waitFor(() =>
			expect(userServerFnMocks.getAccountFn).toHaveBeenCalledTimes(1),
		);
		const held = holdSessionEnd(() => rotation.promise);
		answer.reject(namedError(UNAUTHORIZED_ERROR_NAME));

		await expect(ending).resolves.toBe(false);
		expect(assign).not.toHaveBeenCalled();

		rotation.resolve();
		await held;
		await vi.waitFor(() =>
			expect(userServerFnMocks.getAccountFn).toHaveBeenCalledTimes(2),
		);
		expect(assign).not.toHaveBeenCalled();
	});
});
