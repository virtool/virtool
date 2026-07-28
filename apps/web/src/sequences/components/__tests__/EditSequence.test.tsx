import { cleanup, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createFakeOtuSequence } from "@tests/fake/otus";
import { mockUpdateSequence } from "@tests/server-fn/otus";
import { renderWithProviders } from "@tests/setup";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import SequenceEdit from "../SequenceEdit";

describe("<SequenceEdit>", () => {
	const isolateId = "test_isolate_id";
	const otuId = "test_otu_id";
	const refId = "test_ref_id";
	let activeSequence: ReturnType<typeof createFakeOtuSequence>;

	function renderSequenceEdit(setOpen = vi.fn()) {
		return renderWithProviders(
			<SequenceEdit
				activeSequence={activeSequence}
				isolateId={isolateId}
				open
				otuId={otuId}
				refId={refId}
				schema={[{ molecule: null, name: "segment_a", required: false }]}
				sequences={[activeSequence]}
				setOpen={setOpen}
			/>,
		);
	}

	beforeEach(() => {
		activeSequence = createFakeOtuSequence({
			accession: "initial_accession",
			definition: "initial_definition",
			host: "initial_host",
			sequence: "ACGY",
		});
	});

	afterEach(() => {
		window.sessionStorage.clear();
	});

	it("should render all fields with current sequence data", async () => {
		renderSequenceEdit();

		expect(await screen.findByText("Segment")).toBeInTheDocument();
		expect(screen.getByRole("combobox")).toBeInTheDocument();
		expect(screen.getByRole("textbox", { name: "Accession (ID)" })).toHaveValue(
			activeSequence.accession,
		);
		expect(screen.getByRole("textbox", { name: "Host" })).toHaveValue(
			activeSequence.host,
		);
		expect(screen.getByRole("textbox", { name: "Definition" })).toHaveValue(
			activeSequence.definition,
		);
		expect(screen.getByRole("textbox", { name: /Sequence [0-9]/ })).toHaveValue(
			activeSequence.sequence,
		);
	});

	it("should submit correct data when all fields changed", async () => {
		const updateSequence = mockUpdateSequence({
			accession: "user_typed_accession",
			definition: "user_typed_definition",
			host: "user_typed_host",
			segment: null,
			sequence: "ACGRYKM",
		});

		renderSequenceEdit();

		await userEvent.click(await screen.findByRole("combobox"));
		await userEvent.click(screen.getByRole("option", { name: "None" }));
		await userEvent.clear(
			screen.getByRole("textbox", { name: "Accession (ID)" }),
		);
		await userEvent.type(
			screen.getByRole("textbox", { name: "Accession (ID)" }),
			"user_typed_accession",
		);
		await userEvent.clear(screen.getByRole("textbox", { name: "Host" }));
		await userEvent.type(
			screen.getByRole("textbox", { name: "Host" }),
			"user_typed_host",
		);
		await userEvent.clear(screen.getByRole("textbox", { name: "Definition" }));
		await userEvent.type(
			screen.getByRole("textbox", { name: "Definition" }),
			"user_typed_definition",
		);
		await userEvent.clear(
			screen.getByRole("textbox", { name: /Sequence [0-9]/ }),
		);
		await userEvent.type(
			screen.getByRole("textbox", { name: /Sequence [0-9]/ }),
			"ACGRYKM",
		);

		await userEvent.click(screen.getByRole("button", { name: "Save" }));

		await waitFor(() =>
			expect(updateSequence).toHaveBeenCalledWith({
				data: {
					otuId,
					isolateId,
					sequenceId: activeSequence.id,
					accession: "user_typed_accession",
					definition: "user_typed_definition",
					host: "user_typed_host",
					segment: null,
					sequence: "ACGRYKM",
				},
			}),
		);
	});

	it("should display errors when accession, definition, or sequence not defined", async () => {
		renderSequenceEdit();

		await userEvent.clear(
			await screen.findByRole("textbox", { name: "Accession (ID)" }),
		);
		await userEvent.clear(screen.getByRole("textbox", { name: "Definition" }));
		await userEvent.clear(
			screen.getByRole("textbox", { name: /Sequence [0-9]/ }),
		);
		await userEvent.click(screen.getByRole("button", { name: "Save" }));

		expect(screen.getAllByText("Required Field").length).toBe(3);
	});

	it("should display specific error when sequence contains chars !== ATCGNRYKM", async () => {
		renderSequenceEdit();

		await userEvent.type(
			await screen.findByRole("textbox", { name: /Sequence [0-9]/ }),
			"q",
		);
		await userEvent.click(screen.getByRole("button", { name: "Save" }));

		expect(
			screen.getByText(
				"Sequence should only contain the characters: ATCGNRYKM",
			),
		).toBeInTheDocument();
	});

	it("should clear form cache submitting", async () => {
		const updateSequence = mockUpdateSequence({
			accession: "user_typed_accession",
			definition: "user_typed_definition",
			host: "user_typed_host",
			segment: null,
			sequence: "ACGRYKM",
		});

		renderSequenceEdit();

		await userEvent.click(await screen.findByRole("combobox"));
		await userEvent.click(screen.getByRole("option", { name: "None" }));
		await userEvent.clear(
			screen.getByRole("textbox", { name: "Accession (ID)" }),
		);
		await userEvent.type(
			screen.getByRole("textbox", { name: "Accession (ID)" }),
			"user_typed_accession",
		);
		await userEvent.clear(screen.getByRole("textbox", { name: "Host" }));
		await userEvent.type(
			screen.getByRole("textbox", { name: "Host" }),
			"user_typed_host",
		);
		await userEvent.clear(screen.getByRole("textbox", { name: "Definition" }));
		await userEvent.type(
			screen.getByRole("textbox", { name: "Definition" }),
			"user_typed_definition",
		);
		await userEvent.clear(
			screen.getByRole("textbox", { name: /Sequence [0-9]/ }),
		);
		await userEvent.type(
			screen.getByRole("textbox", { name: /Sequence [0-9]/ }),
			"ACGRYKM",
		);

		await userEvent.click(screen.getByRole("button", { name: "Save" }));

		await waitFor(() =>
			expect(updateSequence).toHaveBeenCalledWith({
				data: {
					otuId,
					isolateId,
					sequenceId: activeSequence.id,
					accession: "user_typed_accession",
					definition: "user_typed_definition",
					host: "user_typed_host",
					segment: null,
					sequence: "ACGRYKM",
				},
			}),
		);

		window.sessionStorage.clear();
		cleanup();

		renderSequenceEdit();

		expect(screen.queryByText("Resumed editing draft sequence.")).toBeNull();
	});
});
