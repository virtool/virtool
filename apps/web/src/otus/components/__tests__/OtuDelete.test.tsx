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
