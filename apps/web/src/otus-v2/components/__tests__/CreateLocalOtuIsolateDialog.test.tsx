import CreateLocalOtuIsolateDialog from "@otus-v2/components/CreateLocalOtuIsolateDialog";
import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { otuV2ServerFnMocks } from "@tests/server-fn/otusV2";
import { renderWithProviders } from "@tests/setup";
import type { GenbankIsolateDraft, OtuV2Plan } from "@virtool/contracts";
import { describe, expect, it, vi } from "vitest";

const draft: GenbankIsolateDraft = {
	name: null,
	sequences: [
		{
			accession: "A",
			definition: "Sequence A",
			length: 4,
			name: null,
			segmentId: crypto.randomUUID(),
			sequence: "ATCG",
		},
	],
};
const plan: OtuV2Plan = {
	id: crypto.randomUUID(),
	segments: [
		{
			id: draft.sequences[0]?.segmentId ?? "",
			name: null,
			length: 4,
			lengthTolerance: 0,
			rule: "required",
		},
	],
};

function renderDialog(isolatePlan = plan) {
	renderWithProviders(
		<CreateLocalOtuIsolateDialog
			open
			setOpen={vi.fn()}
			referenceId="reference"
			otuId="otu"
			version={1}
			plan={isolatePlan}
		/>,
	);
}

describe("<CreateLocalOtuIsolateDialog />", () => {
	it("creates a manual isolate without accession provenance", async () => {
		otuV2ServerFnMocks.createLocalOtuIsolateFn.mockResolvedValueOnce({});
		renderDialog();
		fireEvent.change(screen.getByLabelText("Isolate name"), {
			target: { value: "Lab 2" },
		});
		fireEvent.change(screen.getByLabelText("Genome definition"), {
			target: { value: "Complete genome" },
		});
		fireEvent.change(screen.getByLabelText("Genome sequence"), {
			target: { value: "at cg" },
		});
		fireEvent.click(screen.getByRole("button", { name: "Create isolate" }));
		await waitFor(() => {
			expect(otuV2ServerFnMocks.createLocalOtuIsolateFn).toHaveBeenCalledWith({
				data: {
					referenceId: "reference",
					command: expect.objectContaining({
						type: "CreateIsolate",
						otuId: "otu",
						expectedVersion: 1,
						payload: {
							acknowledgedMissingRecommendedSegments: [],
							isolate: expect.objectContaining({
								name: { type: "isolate", value: "Lab 2" },
								sequences: [
									expect.objectContaining({
										definition: "Complete genome",
										sequence: "ATCG",
										segmentId: plan.segments[0]?.id,
									}),
								],
							}),
						},
					}),
				},
			});
		});
		expect(otuV2ServerFnMocks.getGenbankIsolateDraftFn).not.toHaveBeenCalled();
	});

	it("requires every required plan segment before submitting", async () => {
		renderDialog();
		fireEvent.click(screen.getByRole("button", { name: "Create isolate" }));
		expect(await screen.findByText("Required segment.")).toBeInTheDocument();
		expect(otuV2ServerFnMocks.createLocalOtuIsolateFn).not.toHaveBeenCalled();
	});

	it("allows an optional segment to be omitted from a multipartite isolate", async () => {
		const firstSegment = plan.segments[0];
		if (!firstSegment) {
			throw new Error("Expected a plan segment.");
		}
		const multipartitePlan: OtuV2Plan = {
			...plan,
			segments: [
				{ ...firstSegment, name: { prefix: "RNA", key: "1" } },
				{
					id: crypto.randomUUID(),
					name: { prefix: "RNA", key: "2" },
					length: 4,
					lengthTolerance: 0,
					rule: "optional",
				},
			],
		};
		otuV2ServerFnMocks.createLocalOtuIsolateFn.mockResolvedValueOnce({});
		renderDialog(multipartitePlan);
		fireEvent.change(screen.getByLabelText("RNA 1 definition"), {
			target: { value: "RNA 1" },
		});
		fireEvent.change(screen.getByLabelText("RNA 1 sequence"), {
			target: { value: "ATCG" },
		});
		fireEvent.click(screen.getByRole("button", { name: "Create isolate" }));
		await waitFor(() => {
			const request =
				otuV2ServerFnMocks.createLocalOtuIsolateFn.mock.calls[0]?.[0];
			expect(request.data.command.payload.isolate.sequences).toHaveLength(1);
			expect(request.data.command.payload.isolate.sequences[0].segmentId).toBe(
				multipartitePlan.segments[0]?.id,
			);
		});
	});

	it("requires explicit acknowledgement for an omitted recommended segment", async () => {
		const firstSegment = plan.segments[0];
		if (!firstSegment) {
			throw new Error("Expected a plan segment.");
		}
		const recommendedId = crypto.randomUUID();
		const multipartitePlan: OtuV2Plan = {
			...plan,
			segments: [
				{ ...firstSegment, name: { prefix: "RNA", key: "1" } },
				{
					id: recommendedId,
					name: { prefix: "RNA", key: "2" },
					length: 4,
					lengthTolerance: 0,
					rule: "recommended",
				},
			],
		};
		otuV2ServerFnMocks.createLocalOtuIsolateFn.mockResolvedValueOnce({});
		renderDialog(multipartitePlan);
		fireEvent.change(screen.getByLabelText("RNA 1 definition"), {
			target: { value: "RNA 1" },
		});
		fireEvent.change(screen.getByLabelText("RNA 1 sequence"), {
			target: { value: "ATCG" },
		});
		expect(screen.getByText("Unnamed isolate: RNA 2")).toBeInTheDocument();
		fireEvent.click(screen.getByRole("button", { name: "Create isolate" }));
		expect(
			await screen.findByText(/Acknowledge the missing recommended segments/),
		).toBeInTheDocument();
		expect(otuV2ServerFnMocks.createLocalOtuIsolateFn).not.toHaveBeenCalled();
		fireEvent.click(
			screen.getByRole("checkbox", {
				name: /I acknowledge these recommended segments are missing/,
			}),
		);
		fireEvent.click(screen.getByRole("button", { name: "Create isolate" }));
		await waitFor(() => {
			const payload =
				otuV2ServerFnMocks.createLocalOtuIsolateFn.mock.calls[0]?.[0].data
					.command.payload;
			expect(payload.acknowledgedMissingRecommendedSegments).toEqual([
				{ isolateId: payload.isolate.id, segmentId: recommendedId },
			]);
		});
	});

	it("clears a successful preview when the accession changes", async () => {
		otuV2ServerFnMocks.getGenbankIsolateDraftFn.mockResolvedValueOnce(draft);
		renderDialog();
		fireEvent.click(screen.getByRole("button", { name: "GenBank accessions" }));

		fireEvent.change(screen.getByLabelText("NCBI accessions"), {
			target: { value: "A" },
		});
		fireEvent.click(screen.getByRole("button", { name: "Preview" }));
		expect(
			await screen.findByRole("button", { name: "Create isolate" }),
		).toBeInTheDocument();

		fireEvent.change(screen.getByLabelText("NCBI accessions"), {
			target: { value: "B" },
		});
		expect(
			screen.queryByRole("button", { name: "Create isolate" }),
		).not.toBeInTheDocument();
		expect(screen.queryByText("Sequence A")).not.toBeInTheDocument();

		otuV2ServerFnMocks.getGenbankIsolateDraftFn.mockRejectedValueOnce(
			new Error("B lookup failed"),
		);
		fireEvent.click(screen.getByRole("button", { name: "Preview" }));
		expect(await screen.findByText("B lookup failed")).toBeInTheDocument();
		expect(
			screen.queryByRole("button", { name: "Create isolate" }),
		).not.toBeInTheDocument();
	});

	it("ignores a preview response after the accession changes", async () => {
		const pending = Promise.withResolvers<GenbankIsolateDraft>();
		otuV2ServerFnMocks.getGenbankIsolateDraftFn.mockReturnValueOnce(
			pending.promise,
		);
		renderDialog();
		fireEvent.click(screen.getByRole("button", { name: "GenBank accessions" }));

		fireEvent.change(screen.getByLabelText("NCBI accessions"), {
			target: { value: "A" },
		});
		fireEvent.click(screen.getByRole("button", { name: "Preview" }));
		await waitFor(() => {
			expect(otuV2ServerFnMocks.getGenbankIsolateDraftFn).toHaveBeenCalledTimes(
				1,
			);
		});
		fireEvent.change(screen.getByLabelText("NCBI accessions"), {
			target: { value: "B" },
		});
		await act(async () => {
			pending.resolve(draft);
			await pending.promise;
		});
		expect(
			screen.queryByRole("button", { name: "Create isolate" }),
		).not.toBeInTheDocument();
	});

	it("discards a pending GenBank preview when switching to manual entry", async () => {
		const pending = Promise.withResolvers<GenbankIsolateDraft>();
		otuV2ServerFnMocks.getGenbankIsolateDraftFn.mockReturnValueOnce(
			pending.promise,
		);
		renderDialog();
		fireEvent.click(screen.getByRole("button", { name: "GenBank accessions" }));
		fireEvent.change(screen.getByLabelText("NCBI accessions"), {
			target: { value: "A" },
		});
		fireEvent.click(screen.getByRole("button", { name: "Preview" }));
		await waitFor(() => {
			expect(otuV2ServerFnMocks.getGenbankIsolateDraftFn).toHaveBeenCalledTimes(
				1,
			);
		});
		fireEvent.click(screen.getByRole("button", { name: "Manual entry" }));
		await act(async () => {
			pending.resolve(draft);
			await pending.promise;
		});
		fireEvent.click(screen.getByRole("button", { name: "GenBank accessions" }));
		expect(screen.queryByText("Sequence A")).not.toBeInTheDocument();
		expect(
			screen.queryByRole("button", { name: "Create isolate" }),
		).not.toBeInTheDocument();
	});
});
