import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createFakeOtu } from "@tests/fake/otus";
import { mockDeleteOtu } from "@tests/server-fn/otus";
import { renderWithProviders } from "@tests/setup";
import { beforeEach, describe, expect, it, vi } from "vitest";
import OtuDelete from "../OtuDelete";

describe("<OtuDelete />", () => {
	let otu: ReturnType<typeof createFakeOtu>;

	beforeEach(() => {
		otu = createFakeOtu();
	});

	it("should render when [open=true]", () => {
		renderWithProviders(
			<OtuDelete
				id={otu.id}
				name={otu.name}
				open
				onDeleted={vi.fn()}
				setOpen={vi.fn()}
			/>,
		);

		expect(screen.getByText("Delete OTU")).toBeInTheDocument();
		expect(
			screen.getByText(/Are you sure you want to delete/),
		).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Confirm" })).toBeInTheDocument();
	});

	it("should not render when [open=false]", () => {
		renderWithProviders(
			<OtuDelete
				id={otu.id}
				name={otu.name}
				onDeleted={vi.fn()}
				setOpen={vi.fn()}
			/>,
		);

		expect(screen.queryByText("Delete OTU")).toBeNull();
		expect(screen.queryByText(/Are you sure you want to delete/)).toBeNull();
		expect(screen.queryByRole("button", { name: "Confirm" })).toBeNull();
	});

	it("should call onDeleted after successful removal", async () => {
		const deleteOtu = mockDeleteOtu();
		const onDeleted = vi.fn();

		renderWithProviders(
			<OtuDelete
				id={otu.id}
				name={otu.name}
				open
				onDeleted={onDeleted}
				setOpen={vi.fn()}
			/>,
		);

		await userEvent.click(screen.getByRole("button", { name: "Confirm" }));

		await waitFor(() => expect(onDeleted).toHaveBeenCalledOnce());
		expect(deleteOtu).toHaveBeenCalledWith({ data: { otuId: otu.id } });
	});
});
