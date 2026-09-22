import CreateLocalOtuIsolateDialog from "@otus-v2/components/CreateLocalOtuIsolateDialog";
import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { otuV2ServerFnMocks } from "@tests/server-fn/otusV2";
import { renderWithProviders } from "@tests/setup";
import type { GenbankIsolateDraft } from "@virtool/contracts";
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

function renderDialog() {
	renderWithProviders(
		<CreateLocalOtuIsolateDialog
			open
			setOpen={vi.fn()}
			referenceId="reference"
			otuId="otu"
			version={1}
		/>,
	);
}

describe("<CreateLocalOtuIsolateDialog />", () => {
	it("clears a successful preview when the accession changes", async () => {
		otuV2ServerFnMocks.getGenbankIsolateDraftFn.mockResolvedValueOnce(draft);
		renderDialog();

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
});
