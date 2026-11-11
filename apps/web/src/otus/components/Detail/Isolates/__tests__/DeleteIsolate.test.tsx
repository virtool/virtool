import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { mockDeleteIsolate } from "@tests/server-fn/otus";
import { renderWithProviders } from "@tests/setup";
import type { ComponentProps } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import DeleteIsolate from "../DeleteIsolate";

describe("<DeleteIsolate />", () => {
	let props: ComponentProps<typeof DeleteIsolate>;

	beforeEach(() => {
		props = {
			id: "foo",
			name: "Foo",
			onHide: vi.fn(),
			otuId: "baz",
			show: true,
		};
	});

	it("should handle submit when the confirm button is clicked", async () => {
		const deleteIsolate = mockDeleteIsolate();
		renderWithProviders(<DeleteIsolate {...props} />);

		expect(screen.getByText(/Foo/)).toBeInTheDocument();
		await userEvent.click(screen.getByRole("button", { name: "Confirm" }));
		await waitFor(() => expect(props.onHide).toHaveBeenCalled());

		expect(deleteIsolate).toHaveBeenCalledWith({
			data: { otuId: props.otuId, isolateId: props.id },
		});
	});
});
