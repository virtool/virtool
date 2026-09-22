import { type Mock, vi } from "vitest";

/** Mock handles for the recovery and email-verification server functions. */
export const recoveryServerFnMocks = {
	requestAccountEmailChangeFn: vi.fn(),
	inspectEmailVerificationFn: vi.fn(),
	verifyCurrentEmailFn: vi.fn(),
	completeAccountEmailChangeFn: vi.fn(),
	requestPasswordRecoveryFn: vi.fn(),
	inspectPasswordRecoveryFn: vi.fn(),
	completePasswordRecoveryFn: vi.fn(),
	issueAdministratorRecoveryFn: vi.fn(),
	revokeAdministratorRecoveryFn: vi.fn(),
};

/** Resolve an account-email request with a queued challenge. */
export function mockRequestAccountEmailChange(): Mock {
	recoveryServerFnMocks.requestAccountEmailChangeFn.mockResolvedValue({
		status: "queued",
		expiresAt: new Date(Date.now() + 60_000),
		resendAt: new Date(Date.now() + 30_000),
	});
	return recoveryServerFnMocks.requestAccountEmailChangeFn;
}
