import { accountQueryKeys } from "@account/keys";
import { RecentAuthenticationProvider } from "@app/recentAuthentication";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { accountServerFnMocks } from "@tests/server-fn/account";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	activeBrowserSessionsQueryOptions,
	useRevokeBrowserSession,
	useRevokeOtherBrowserSessions,
} from "../sessions";

function createWrapper(queryClient: QueryClient) {
	return function Wrapper({ children }: { children: ReactNode }) {
		return (
			<QueryClientProvider client={queryClient}>
				<RecentAuthenticationProvider>{children}</RecentAuthenticationProvider>
			</QueryClientProvider>
		);
	};
}

describe("active browser session queries", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("uses the narrow account-session query key", async () => {
		accountServerFnMocks.findActiveBrowserSessionsFn.mockResolvedValue([]);
		const options = activeBrowserSessionsQueryOptions();

		expect(options.queryKey).toEqual(accountQueryKeys.activeSessions());
		await expect(options.queryFn?.({} as never)).resolves.toEqual([]);
	});

	it("invalidates only after selected revocation commits", async () => {
		const queryClient = new QueryClient();
		const invalidateQueries = vi.spyOn(queryClient, "invalidateQueries");
		accountServerFnMocks.revokeBrowserSessionFn.mockResolvedValue(null);
		const { result } = renderHook(() => useRevokeBrowserSession(), {
			wrapper: createWrapper(queryClient),
		});

		result.current.mutate({ managementId: 42 });
		await waitFor(() => expect(result.current.isSuccess).toBe(true));

		expect(accountServerFnMocks.revokeBrowserSessionFn).toHaveBeenCalledWith({
			data: { managementId: 42 },
		});
		expect(invalidateQueries).toHaveBeenCalledWith({
			queryKey: accountQueryKeys.activeSessions(),
		});
	});

	it("preserves the cached list when revocation fails", async () => {
		const queryClient = new QueryClient();
		const invalidateQueries = vi.spyOn(queryClient, "invalidateQueries");
		accountServerFnMocks.revokeBrowserSessionFn.mockRejectedValue(
			new Error("failed"),
		);
		const { result } = renderHook(() => useRevokeBrowserSession(), {
			wrapper: createWrapper(queryClient),
		});

		result.current.mutate({ managementId: 42 });
		await waitFor(() => expect(result.current.isError).toBe(true));

		expect(invalidateQueries).not.toHaveBeenCalled();
	});

	it("refreshes the list after all-other revocation", async () => {
		const queryClient = new QueryClient();
		const invalidateQueries = vi.spyOn(queryClient, "invalidateQueries");
		accountServerFnMocks.revokeOtherBrowserSessionsFn.mockResolvedValue({
			revoked: 2,
		});
		const { result } = renderHook(() => useRevokeOtherBrowserSessions(), {
			wrapper: createWrapper(queryClient),
		});

		result.current.mutate();
		await waitFor(() => expect(result.current.isSuccess).toBe(true));

		expect(invalidateQueries).toHaveBeenCalledWith({
			queryKey: accountQueryKeys.activeSessions(),
		});
	});
});
