import { useRecentlyAuthenticatedMutation } from "@app/recentAuthentication";
import { act, renderHook, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { recentAuthenticationServerFnMocks } from "@tests/server-fn/recentAuthentication";
import { wrapWithProviders } from "@tests/setup";
import { SESSION_NOT_FRESH_ERROR_NAME } from "@virtool/contracts";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

function staleError() {
	return Object.assign(new Error("Recent authentication required"), {
		name: SESSION_NOT_FRESH_ERROR_NAME,
	});
}

function wrapper({ children }: { children: ReactNode }) {
	return wrapWithProviders(children);
}

describe("recent authentication orchestration", () => {
	beforeEach(() => {
		recentAuthenticationServerFnMocks.getRecentAuthenticationMethodsFn.mockResolvedValue(
			{ password: true, totp: false },
		);
		recentAuthenticationServerFnMocks.challengeRecentAuthenticationFn.mockResolvedValue(
			{ createdAt: new Date(), sessionId: 2 },
		);
	});

	it("preserves variables and retries the original mutation exactly once", async () => {
		const operation = vi
			.fn<(variables: { email: string }) => Promise<string>>()
			.mockRejectedValueOnce(staleError())
			.mockResolvedValueOnce("updated");
		const variables = { email: "alice@example.com" };
		const { result } = renderHook(
			() => useRecentlyAuthenticatedMutation(operation),
			{ wrapper },
		);

		let promise: Promise<string> | undefined;
		act(() => {
			promise = result.current(variables);
		});
		await userEvent.type(await screen.findByLabelText("Password"), "secret");
		await userEvent.click(screen.getByRole("button", { name: "Continue" }));

		await expect(promise).resolves.toBe("updated");
		expect(operation).toHaveBeenCalledTimes(2);
		expect(operation).toHaveBeenNthCalledWith(1, variables);
		expect(operation).toHaveBeenNthCalledWith(2, variables);
	});

	it("shares one challenge among simultaneous mutations", async () => {
		const first = vi
			.fn<(value: number) => Promise<number>>()
			.mockRejectedValueOnce(staleError())
			.mockResolvedValueOnce(1);
		const second = vi
			.fn<(value: number) => Promise<number>>()
			.mockRejectedValueOnce(staleError())
			.mockResolvedValueOnce(2);
		const { result } = renderHook(
			() => ({
				first: useRecentlyAuthenticatedMutation(first),
				second: useRecentlyAuthenticatedMutation(second),
			}),
			{ wrapper },
		);

		let promises: Promise<number>[] = [];
		act(() => {
			promises = [result.current.first(1), result.current.second(2)];
		});
		await userEvent.type(await screen.findByLabelText("Password"), "secret");
		await userEvent.click(screen.getByRole("button", { name: "Continue" }));

		await expect(Promise.all(promises)).resolves.toEqual([1, 2]);
		expect(
			recentAuthenticationServerFnMocks.getRecentAuthenticationMethodsFn,
		).toHaveBeenCalledTimes(1);
		expect(
			recentAuthenticationServerFnMocks.challengeRecentAuthenticationFn,
		).toHaveBeenCalledTimes(1);
	});

	it("cancels without applying the mutation and clears credentials", async () => {
		const operation = vi
			.fn<(value: string) => Promise<string>>()
			.mockRejectedValue(staleError());
		const { result } = renderHook(
			() => useRecentlyAuthenticatedMutation(operation),
			{ wrapper },
		);

		let first: Promise<string> | undefined;
		act(() => {
			first = result.current("unchanged");
		});
		const password = await screen.findByLabelText("Password");
		await userEvent.type(password, "secret");
		const firstRejection = expect(first).rejects.toThrow("cancelled");
		await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
		await firstRejection;
		expect(operation).toHaveBeenCalledTimes(1);

		let second: Promise<string> | undefined;
		act(() => {
			second = result.current("unchanged");
		});
		await waitFor(() =>
			expect(screen.getByLabelText("Password")).toHaveValue(""),
		);
		const secondRejection = expect(second).rejects.toThrow("cancelled");
		await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
		await secondRejection;
	});

	it("clears credentials and does not retry after a terminal provider failure", async () => {
		const operation = vi
			.fn<(value: string) => Promise<string>>()
			.mockRejectedValueOnce(staleError());
		recentAuthenticationServerFnMocks.challengeRecentAuthenticationFn.mockRejectedValue(
			new Error("provider unavailable"),
		);
		const { result } = renderHook(
			() => useRecentlyAuthenticatedMutation(operation),
			{ wrapper },
		);

		let promise: Promise<string> | undefined;
		act(() => {
			promise = result.current("unchanged");
		});
		await userEvent.type(await screen.findByLabelText("Password"), "secret");
		const rejection = expect(promise).rejects.toThrow("provider unavailable");
		await userEvent.click(screen.getByRole("button", { name: "Continue" }));

		await rejection;
		expect(operation).toHaveBeenCalledTimes(1);
		expect(screen.queryByLabelText("Password")).not.toBeInTheDocument();
	});
});
