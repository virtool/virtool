import { CLIENT_ERROR_NAME, type User } from "@virtool/contracts";
import { type Mock, vi } from "vitest";

/**
 * Mock handles for the `@server/auth/functions` server-fn module. Wired in
 * globally from `tests/setup.tsx` so route-level tests can stub the
 * unauthenticated auth server functions without per-file `vi.mock` boilerplate.
 */
export const authServerFnMocks = {
	acceptAccountSetupFn: vi.fn(),
	cancelEmailRemediationFn: vi.fn(),
	changeEmailRemediationFn: vi.fn(),
	refreshBrowserSessionFn: vi.fn(),
	completeEmailRemediationFn: vi.fn(),
	loginFn: vi.fn(),
	getEmailRemediationFn: vi.fn(),
	inspectAccountSetupFn: vi.fn(),
	promoteEmailRemediationFn: vi.fn(),
	resendEmailRemediationFn: vi.fn(),
	verifyTwoFactorFn: vi.fn(),
	logoutFn: vi.fn(),
	resetPasswordFn: vi.fn(),
	createFirstUserFn: vi.fn(),
	submitEmailRemediationFn: vi.fn(),
};

/**
 * Build the error that a server function rejects with when it refuses a request
 * with a message for the user.
 */
export function createClientError(message: string, status = 400): Error {
	return Object.assign(new Error(message), { name: CLIENT_ERROR_NAME, status });
}

/**
 * Sets up createFirstUserFn to resolve with the given user (or reject with the
 * given message on a 4xx code, e.g. 409 when a user already exists).
 */
export function mockCreateFirstUser(
	user?: Partial<User>,
	statusCode = 201,
	message = "Virtool already has a user.",
): Mock {
	if (statusCode >= 400) {
		authServerFnMocks.createFirstUserFn.mockRejectedValue(
			createClientError(message, statusCode),
		);
	} else {
		authServerFnMocks.createFirstUserFn.mockResolvedValue({
			user: user ?? {},
			emailVerificationRequired: false,
		});
	}
	return authServerFnMocks.createFirstUserFn;
}
