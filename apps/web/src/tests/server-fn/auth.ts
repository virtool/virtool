import type { User } from "@virtool/contracts";
import { type Mock, vi } from "vitest";

/**
 * Mock handles for the `@server/auth/functions` server-fn module. Wired in
 * globally from `tests/setup.tsx` so route-level tests can stub the
 * unauthenticated auth server functions without per-file `vi.mock` boilerplate.
 */
export const authServerFnMocks = {
	loginFn: vi.fn(),
	logoutFn: vi.fn(),
	resetPasswordFn: vi.fn(),
	createFirstUserFn: vi.fn(),
};

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
		authServerFnMocks.createFirstUserFn.mockRejectedValue(new Error(message));
	} else {
		authServerFnMocks.createFirstUserFn.mockResolvedValue(user ?? {});
	}
	return authServerFnMocks.createFirstUserFn;
}
