import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createFakeOtu } from "@tests/fake/otus";
import { mockDeleteSequence } from "@tests/server-fn/otus";
import { at, renderWithProviders } from "@tests/setup";
import { beforeEach, describe, expect, it, vi } from "vitest";
import DeleteSequence from "../DeleteSequence";

describe("<DeleteSequence />", () => {
	let otu: ReturnType<typeof createFakeOtu>;
	let isolate: ReturnType<typeof createFakeOtu>["isolates"][number];
	let sequence: (typeof isolate)["sequences"][number];
	let isolateName: string;

	beforeEach(() => {
		otu = createFakeOtu();
		isolate = at(otu.isolates, 0);
		sequence = at(isolate.sequences, 0);
		const sourceType =
			isolate.sourceType.charAt(0).toUpperCase() + isolate.sourceType.slice(1);
		isolateName = `${sourceType} ${isolate.sourceName}`;
	});

	it("should render when [open=true]", () => {
		renderWithProviders(
			<DeleteSequence
				isolateId={isolate.id}
				isolateName={isolateName}
				otuId={otu.id}
				open
				sequence={sequence}
				setOpen={vi.fn()}
			/>,
		);

		expect(screen.getByText("Delete Sequence")).toBeInTheDocument();
		expect(
			screen.getByText(/Are you sure you want to delete the sequence/),
		).toBeInTheDocument();
		expect(screen.getByText(sequence.accession)).toBeInTheDocument();
		expect(screen.getByText(isolateName)).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Confirm" })).toBeInTheDocument();
	});

	it("should not render when [open=false]", () => {
		renderWithProviders(
			<DeleteSequence
				isolateId={isolate.id}
				isolateName={isolateName}
				otuId={otu.id}
				sequence={sequence}
				setOpen={vi.fn()}
			/>,
		);

		expect(screen.queryByText("Delete Sequence")).toBeNull();
		expect(screen.queryByRole("button", { name: "Confirm" })).toBeNull();
	});

	it("should call the server and close the dialog when Confirm is clicked", async () => {
		const deleteSequence = mockDeleteSequence();
		const setOpen = vi.fn();

		renderWithProviders(
			<DeleteSequence
				isolateId={isolate.id}
				isolateName={isolateName}
				otuId={otu.id}
				open
				sequence={sequence}
				setOpen={setOpen}
			/>,
		);

		await userEvent.click(screen.getByRole("button", { name: "Confirm" }));

		await waitFor(() => expect(setOpen).toHaveBeenCalledWith(false));
		expect(deleteSequence).toHaveBeenCalledWith({
			data: {
				otuId: otu.id,
				isolateId: isolate.id,
				sequenceId: sequence.id,
			},
		});
	});
});
