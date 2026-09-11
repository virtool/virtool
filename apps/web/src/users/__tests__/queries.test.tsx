import { analysesQueryKeys } from "@analyses/keys";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { createFakeUser } from "@tests/fake/user";
import { mockUpdateUser } from "@tests/server-fn/users";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { useUpdateUser } from "../queries";

describe("useUpdateUser()", () => {
	it("invalidates analysis user options after updating a user", async () => {
		const queryClient = new QueryClient();
		const analysisUsers = analysesQueryKeys.users([1, ["pathoscope"]]);
		queryClient.setQueryData(analysisUsers, []);
		const user = createFakeUser();
		mockUpdateUser(user.id, 200, { handle: "new_handle" }, user);

		function wrapper({ children }: { children: ReactNode }) {
			return (
				<QueryClientProvider client={queryClient}>
					{children}
				</QueryClientProvider>
			);
		}

		const { result } = renderHook(() => useUpdateUser(), { wrapper });
		result.current.mutate({
			userId: user.id,
			update: { handle: "new_handle" },
		});

		await waitFor(() => expect(result.current.isSuccess).toBe(true));

		expect(queryClient.getQueryState(analysisUsers)?.isInvalidated).toBe(true);
	});
});
