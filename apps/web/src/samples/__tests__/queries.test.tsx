import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { mockCreateSample } from "@tests/server-fn/samples";
import { fileQueryKeys } from "@uploads/keys";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { useCreateSample } from "../queries";

describe("useCreateSample()", () => {
	it("invalidates the reads selector on success so reserved files leave it", async () => {
		const queryClient = new QueryClient();
		const invalidateQueries = vi.spyOn(queryClient, "invalidateQueries");

		mockCreateSample();

		function wrapper({ children }: { children: ReactNode }) {
			return (
				<QueryClientProvider client={queryClient}>
					{children}
				</QueryClientProvider>
			);
		}

		const { result } = renderHook(() => useCreateSample(), { wrapper });

		result.current.mutate({
			name: "Sample A",
			isolate: "",
			host: "",
			locale: "",
			libraryType: "normal",
			subtractions: [],
			files: [1],
			labels: [],
			group: null,
		});

		await waitFor(() => expect(result.current.isSuccess).toBe(true));

		expect(invalidateQueries).toHaveBeenCalledWith({
			queryKey: [...fileQueryKeys.infiniteLists(), "reads"],
		});
	});
});
