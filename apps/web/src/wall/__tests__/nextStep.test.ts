import { accountQueryKeys } from "@account/keys";
import { QueryClient } from "@tanstack/react-query";
import { createFakeAccount } from "@tests/fake/account";
import { mockGetAccount, userServerFnMocks } from "@tests/server-fn/users";
import {
	MFA_ENROLLMENT_REQUIRED_ERROR_NAME,
	PASSWORD_RESET_REQUIRED_ERROR_NAME,
	SETUP_REQUIRED_ERROR_NAME,
	UNAUTHORIZED_ERROR_NAME,
} from "@virtool/contracts";
import { describe, expect, it } from "vitest";
import { rootQueryKeys } from "../keys";
import {
	getAuthNextStep,
	getAuthNextStepRoute,
	resolveAuthNextStep,
} from "../nextStep";

function namedError(name: string, purpose?: string) {
	return Object.assign(new Error(name), { name, purpose });
}

describe("getAuthNextStep", () => {
	it.each([
		[UNAUTHORIZED_ERROR_NAME, undefined, "login"],
		[PASSWORD_RESET_REQUIRED_ERROR_NAME, undefined, "password_reset"],
		[MFA_ENROLLMENT_REQUIRED_ERROR_NAME, undefined, "mfa_enrollment"],
		[SETUP_REQUIRED_ERROR_NAME, "email_remediation", "email_remediation"],
		[SETUP_REQUIRED_ERROR_NAME, "account_completion", "login"],
	])("maps %s (%s) to %s", (name, purpose, type) => {
		expect(getAuthNextStep(namedError(name, purpose))).toEqual({ type });
	});

	it("says nothing about an error that is not about the principal", () => {
		expect(getAuthNextStep(new TypeError("Failed to fetch"))).toBeNull();
		expect(getAuthNextStep("not an error")).toBeNull();
	});
});

describe("getAuthNextStepRoute", () => {
	it("carries the redirect into the application and every wall", () => {
		expect(getAuthNextStepRoute({ type: "application" }, "/samples")).toEqual({
			to: "/samples",
		});
		expect(getAuthNextStepRoute({ type: "application" })).toEqual({ to: "/" });
		expect(
			getAuthNextStepRoute({ type: "mfa_enrollment" }, "/samples"),
		).toEqual({ to: "/mfa-enrollment", search: { redirect: "/samples" } });
		expect(
			getAuthNextStepRoute({ type: "email_remediation" }, "/samples"),
		).toEqual({ to: "/email-remediation", search: { redirect: "/samples" } });
		expect(getAuthNextStepRoute({ type: "login" }, "/samples")).toEqual({
			to: "/login",
			search: { redirect: "/samples" },
		});
	});
});

describe("resolveAuthNextStep", () => {
	it("drops the previous principal's caches and refetches the account", async () => {
		const queryClient = new QueryClient({
			defaultOptions: { queries: { retry: false } },
		});
		queryClient.setQueryData(rootQueryKeys.all(), { firstUser: true });
		queryClient.setQueryData(
			accountQueryKeys.all(),
			createFakeAccount({ handle: "previous" }),
		);
		const account = createFakeAccount({ handle: "current" });
		const getAccount = mockGetAccount(account);

		await expect(resolveAuthNextStep(queryClient)).resolves.toEqual({
			type: "application",
		});
		expect(getAccount).toHaveBeenCalledOnce();
		expect(queryClient.getQueryData(rootQueryKeys.all())).toBeUndefined();
		expect(queryClient.getQueryData(accountQueryKeys.all())).toEqual(account);
	});

	it("returns the restriction that the server reports", async () => {
		const queryClient = new QueryClient({
			defaultOptions: { queries: { retry: false } },
		});
		userServerFnMocks.getAccountFn.mockRejectedValue(
			namedError(MFA_ENROLLMENT_REQUIRED_ERROR_NAME),
		);

		await expect(resolveAuthNextStep(queryClient)).resolves.toEqual({
			type: "mfa_enrollment",
		});
	});

	it("rethrows a failure that says nothing about the principal", async () => {
		const queryClient = new QueryClient({
			defaultOptions: { queries: { retry: false } },
		});
		const failure = new TypeError("Failed to fetch");
		userServerFnMocks.getAccountFn.mockRejectedValue(failure);

		await expect(resolveAuthNextStep(queryClient)).rejects.toBe(failure);
	});
});
