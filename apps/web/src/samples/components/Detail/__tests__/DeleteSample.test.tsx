import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createFakeJobNested } from "@tests/fake/jobs";
import { mockDeleteSample } from "@tests/server-fn/samples";
import { renderWithRouter } from "@tests/setup";
import type { ComponentProps } from "react";
import { beforeEach, describe, expect, it } from "vitest";
import DeleteSample from "../DeleteSample";

describe("<DeleteSample />", () => {
	let props: ComponentProps<typeof DeleteSample>;

	beforeEach(() => {
		props = {
			id: 1,
			name: "test",
			ready: true,
		};
	});

	it("does not render when sample has running job", async () => {
		await renderWithRouter(
			<DeleteSample
				{...props}
				ready={false}
				job={createFakeJobNested({ state: "running" })}
			/>,
		);

		expect(screen.queryByRole("button")).toBeNull();
	});

	it("should handle submit when confirm button is clicked", async () => {
		const deleteSample = mockDeleteSample();
		await renderWithRouter(<DeleteSample {...props} />);

		await userEvent.click(screen.getByRole("button"));
		expect(screen.getByText("Delete Sample")).toBeInTheDocument();

		await userEvent.click(screen.getByText("Confirm"));

		await waitFor(() => expect(deleteSample).toHaveBeenCalled());
	});
});
