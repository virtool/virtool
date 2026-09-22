import CreateLocalOtuFromAccessionForm from "@otus-v2/components/CreateLocalOtuFromAccessionForm";
import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { otuV2ServerFnMocks } from "@tests/server-fn/otusV2";
import { renderWithRouter } from "@tests/setup";
import type { GenbankOtuDraft } from "@virtool/contracts";
import { describe, expect, it } from "vitest";

const draft: GenbankOtuDraft = {
	molecule: { type: "RNA", strandedness: "single", topology: "linear" },
	taxonomy: {
		name: "Tobacco mosaic virus",
		acronym: "TMV",
		lineage: [{ id: 12242, name: "Tobacco mosaic virus", rank: "species" }],
	},
	isolate: { type: "isolate", value: "U1" },
	segments: [
		{
			accession: "NC_001367.1",
			name: null,
			definition: "Complete genome",
			sequence: "ATCG",
			length: 4,
		},
	],
};

async function renderForm() {
	return renderWithRouter(
		<CreateLocalOtuFromAccessionForm
			referenceId="reference"
			defaultSegmentLengthTolerance={0.05}
		/>,
	);
}

describe("<CreateLocalOtuFromAccessionForm />", () => {
	it("resolves and displays a draft before a curator confirms creation", async () => {
		otuV2ServerFnMocks.getGenbankOtuDraftFn.mockResolvedValueOnce(draft);
		otuV2ServerFnMocks.createLocalOtuFn.mockReturnValueOnce(
			new Promise(() => {}),
		);
		await renderForm();
		await userEvent.type(screen.getByLabelText("Accessions"), "NC_001367.1");
		await userEvent.click(screen.getByRole("button", { name: "Preview" }));
		expect(otuV2ServerFnMocks.getGenbankOtuDraftFn).toHaveBeenCalledWith({
			data: { referenceId: "reference", accessions: ["NC_001367.1"] },
		});
		expect(otuV2ServerFnMocks.createLocalOtuFn).not.toHaveBeenCalled();
		expect(
			await screen.findByText("Tobacco mosaic virus (TMV)"),
		).toBeInTheDocument();
		expect(screen.getByText("Isolate: U1")).toBeInTheDocument();
		expect(screen.getByText("Complete genome")).toBeInTheDocument();
		await userEvent.click(screen.getByRole("button", { name: "Create OTU" }));
		await waitFor(() => {
			expect(otuV2ServerFnMocks.createLocalOtuFn).toHaveBeenCalledTimes(1);
		});
		const command =
			otuV2ServerFnMocks.createLocalOtuFn.mock.calls[0]?.[0].data.command;
		expect(command.payload.plan.segments[0].lengthTolerance).toBe(0.05);
		expect(command.payload.genbank.sequences[0].accession).toBe("NC_001367.1");
	});

	it("clears a preview when accessions change and ignores a late response", async () => {
		const pending = Promise.withResolvers<GenbankOtuDraft>();
		otuV2ServerFnMocks.getGenbankOtuDraftFn.mockReturnValueOnce(
			pending.promise,
		);
		await renderForm();
		await userEvent.type(screen.getByLabelText("Accessions"), "NC_001367.1");
		await userEvent.click(screen.getByRole("button", { name: "Preview" }));
		await waitFor(() => {
			expect(otuV2ServerFnMocks.getGenbankOtuDraftFn).toHaveBeenCalledTimes(1);
		});
		await userEvent.type(screen.getByLabelText("Accessions"), " NC_001368.1");
		await act(async () => {
			pending.resolve(draft);
			await pending.promise;
		});
		expect(
			screen.queryByRole("button", { name: "Create OTU" }),
		).not.toBeInTheDocument();
		expect(otuV2ServerFnMocks.createLocalOtuFn).not.toHaveBeenCalled();
		otuV2ServerFnMocks.getGenbankOtuDraftFn.mockResolvedValueOnce(draft);
		await userEvent.click(screen.getByRole("button", { name: "Preview" }));
		expect(
			await screen.findByRole("button", { name: "Create OTU" }),
		).toBeInTheDocument();
		await userEvent.type(screen.getByLabelText("Accessions"), "X");
		expect(
			screen.queryByRole("button", { name: "Create OTU" }),
		).not.toBeInTheDocument();
	});
});
