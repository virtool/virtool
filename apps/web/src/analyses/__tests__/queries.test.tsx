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
	it("refreshes the analyses lists and the analysed sample", async () => {
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

		// The new row belongs in the sample's analyses list, and the sample's
		// workflow tags change in both its list row and its detail.
		expect(invalidateQueries).toHaveBeenCalledWith({
			queryKey: analysesQueryKeys.lists(),
		});
		expect(invalidateQueries).toHaveBeenCalledWith({
			queryKey: samplesQueryKeys.all(),
		});
	});
});
