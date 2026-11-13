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

	it("should call the server and close the dialog when Confirm is clicked", async () => {
		const schema = otu.schema.filter((s) => s.name !== segmentName);
		const updateOtu = mockUpdateOtu({ ...otu, schema });
		const setOpen = vi.fn();

		renderWithProviders(
			<DeleteSegment
				acronym={otu.acronym}
				name={otu.name}
				open
				otuId={otu.id}
				schema={otu.schema}
				segmentName={segmentName}
				setOpen={setOpen}
			/>,
		);

		expect(screen.getByText(segmentName)).toBeInTheDocument();
		await userEvent.click(screen.getByRole("button", { name: "Confirm" }));

		await waitFor(() => expect(setOpen).toHaveBeenCalledWith(false));
		expect(updateOtu).toHaveBeenCalledWith({
			data: {
				otuId: otu.id,
				name: otu.name,
				acronym: otu.acronym,
				schema,
			},
		});
	});
});
