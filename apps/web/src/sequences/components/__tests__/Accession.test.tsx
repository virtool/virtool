import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createFakeOtu } from "@tests/fake/otus";
import { createFakeReference } from "@tests/fake/references";
import { mockGetGenbank } from "@tests/server-fn/otus";
import { at, renderWithProviders } from "@tests/setup";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CreateSequence from "../CreateSequence";

describe("<Accession> auto fill", () => {
	let otu: ReturnType<typeof createFakeOtu>;
	let reference: ReturnType<typeof createFakeReference>;

	function renderAccession() {
		const isolate = at(otu.isolates, 0);
		return renderWithProviders(
			<CreateSequence
				isolateId={isolate.id}
				open
				otuId={otu.id}
				refId={String(reference.id)}
				schema={otu.schema}
				sequences={isolate.sequences}
				setOpen={vi.fn()}
			/>,
		);
	}

	beforeEach(() => {
		reference = createFakeReference();
		otu = createFakeOtu();
	});

	afterEach(() => {
		window.sessionStorage.clear();
	});

	it("should fill the form from the Genbank record", async () => {
		const getGenbank = mockGetGenbank("NC_010317", {
			accession: "NC_010317",
			definition: "Abaca bunchy top virus DNA-R",
			host: "Musa textilis",
			sequence: "ATGRYKM",
		});

		renderAccession();

		await userEvent.type(
			await screen.findByRole("textbox", { name: "Accession (ID)" }),
			"NC_010317",
		);
		await userEvent.click(screen.getByRole("button", { name: "Auto Fill" }));

		await waitFor(() => expect(getGenbank).toHaveBeenCalled());

		expect(screen.getByRole("textbox", { name: "Host" })).toHaveValue(
			"Musa textilis",
		);
		expect(screen.getByRole("textbox", { name: "Definition" })).toHaveValue(
			"Abaca bunchy top virus DNA-R",
		);
		expect(screen.getByRole("textbox", { name: /^Sequence/ })).toHaveValue(
			"ATGRYKM",
		);
	});

	it("should report an unknown accession and clear the error on retyping", async () => {
		const getGenbank = mockGetGenbank("NC_000000", null);

		renderAccession();

		await userEvent.type(
			await screen.findByRole("textbox", { name: "Accession (ID)" }),
			"NC_000000",
		);
		await userEvent.click(screen.getByRole("button", { name: "Auto Fill" }));

		await waitFor(() => expect(getGenbank).toHaveBeenCalled());

		expect(await screen.findByText("Accession not found")).toBeInTheDocument();

		await userEvent.type(
			screen.getByRole("textbox", { name: "Accession (ID)" }),
			"1",
		);

		expect(screen.queryByText("Accession not found")).not.toBeInTheDocument();
	});
});
