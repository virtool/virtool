import { analysesQueryKeys } from "@analyses/keys";
import { samplesQueryKeys } from "@samples/keys";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { createFakeAnalysisMinimal } from "@tests/fake/analyses";
import { mockCreateAnalysis } from "@tests/server-fn/analyses";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { useCreateAnalysis } from "../queries";

describe("useCreateAnalysis()", () => {
	it("narrows the analyses invalidation to the analysed sample", async () => {
		const queryClient = new QueryClient();
		const invalidateQueries = vi.spyOn(queryClient, "invalidateQueries");

		const createAnalysis = mockCreateAnalysis(
			createFakeAnalysisMinimal({ sample: { id: 1, name: "Sample 1" } }),
		);

		function wrapper({ children }: { children: ReactNode }) {
			return (
				<QueryClientProvider client={queryClient}>
					{children}
				</QueryClientProvider>
			);
		}

		const { result } = renderHook(() => useCreateAnalysis(), { wrapper });

		result.current.mutate({
			sampleId: 1,
			workflow: "pathoscope",
			refId: 1,
			subtractionIds: [],
		});

		await waitFor(() => expect(result.current.isSuccess).toBe(true));

		expect(createAnalysis).toHaveBeenCalledWith({
			data: {
				sampleId: 1,
				refId: 1,
				subtractionIds: [],
				workflow: "pathoscope",
			},
		});

		expect(invalidateQueries).toHaveBeenCalledWith({
			queryKey: [...analysesQueryKeys.lists(), 1],
		});
		expect(invalidateQueries).not.toHaveBeenCalledWith({
			queryKey: analysesQueryKeys.lists(),
		});
		// The samples-list row renders the sample's workflow tags from its own
		// list entry, so the lists are refreshed. The detail cache is left to the
		// SSE frame, so creating an analysis does not refetch it.
		expect(invalidateQueries).toHaveBeenCalledWith({
			queryKey: samplesQueryKeys.lists(),
		});
		expect(invalidateQueries).not.toHaveBeenCalledWith({
			queryKey: samplesQueryKeys.detail(1),
		});
	});
});
