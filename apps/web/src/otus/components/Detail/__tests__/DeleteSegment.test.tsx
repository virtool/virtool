import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createFakeOtu } from "@tests/fake/otus";
import { mockUpdateOtu } from "@tests/server-fn/otus";
import { at, renderWithProviders } from "@tests/setup";
import { beforeEach, describe, expect, it, vi } from "vitest";
import DeleteSegment from "../DeleteSegment";

describe("<DeleteSegment />", () => {
	let otu: ReturnType<typeof createFakeOtu>;
	let segmentName: string;

	beforeEach(() => {
		otu = createFakeOtu();
		segmentName = at(otu.schema, 0).name;
	});

	it("should render when [open=true]", () => {
		renderWithProviders(
			<DeleteSegment
				abbreviation={otu.abbreviation}
				name={otu.name}
				open
				otuId={otu.id}
				schema={otu.schema}
				segmentName={segmentName}
				setOpen={vi.fn()}
			/>,
		);

		expect(screen.getByText("Delete Segment")).toBeInTheDocument();
		expect(
			screen.getByText(/Are you sure you want to delete/),
		).toBeInTheDocument();
		expect(screen.getByText(segmentName)).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Confirm" })).toBeInTheDocument();
	});

	it("should not render when [open=false]", () => {
		renderWithProviders(
			<DeleteSegment
				abbreviation={otu.abbreviation}
				name={otu.name}
				otuId={otu.id}
				schema={otu.schema}
				segmentName={segmentName}
				setOpen={vi.fn()}
			/>,
		);

		expect(screen.queryByText("Delete Segment")).toBeNull();
		expect(screen.queryByText(/Are you sure you want to delete/)).toBeNull();
		expect(screen.queryByRole("button", { name: "Confirm" })).toBeNull();
	});

	it("should call the server and close the dialog when Confirm is clicked", async () => {
		const schema = otu.schema.filter((s) => s.name !== segmentName);
		const updateOtu = mockUpdateOtu({ ...otu, schema });
		const setOpen = vi.fn();

		renderWithProviders(
			<DeleteSegment
				abbreviation={otu.abbreviation}
				name={otu.name}
				open
				otuId={otu.id}
				schema={otu.schema}
				segmentName={segmentName}
				setOpen={setOpen}
			/>,
		);

		await userEvent.click(screen.getByRole("button", { name: "Confirm" }));

		await waitFor(() => expect(setOpen).toHaveBeenCalledWith(false));
		expect(updateOtu).toHaveBeenCalledWith({
			data: {
				otuId: otu.id,
				name: otu.name,
				abbreviation: otu.abbreviation,
				schema,
			},
		});
	});

	it("should call setOpen(false) when dialog is dismissed", async () => {
		const setOpen = vi.fn();

		renderWithProviders(
			<DeleteSegment
				abbreviation={otu.abbreviation}
				name={otu.name}
				open
				otuId={otu.id}
				schema={otu.schema}
				segmentName={segmentName}
				setOpen={setOpen}
			/>,
		);

		await userEvent.keyboard("{Escape}");

		await waitFor(() => expect(setOpen).toHaveBeenCalledWith(false));
	});
});
