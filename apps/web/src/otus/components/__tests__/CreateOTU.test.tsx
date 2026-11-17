import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createFakeOtu } from "@tests/fake/otus";
import { createFakeReference } from "@tests/fake/references";
import { mockCreateOtu } from "@tests/server-fn/otus";
import { mockGetReference } from "@tests/server-fn/references";
import { renderWithProviders } from "@tests/setup";
import { beforeEach, describe, expect, it, vi } from "vitest";
import OtuCreate from "../OtuCreate";

describe("<OtuCreate />", () => {
	let reference: ReturnType<typeof createFakeReference>;

	beforeEach(() => {
		reference = createFakeReference();
		mockGetReference(reference);
	});

	it("should render error once submitted with no name", async () => {
		renderWithProviders(
			<OtuCreate open refId={reference.id} setOpen={vi.fn()} />,
		);

		await userEvent.click(screen.getByRole("button", { name: "Save" }));
		expect(await screen.findByText("Name required")).toBeInTheDocument();
	});

	it.each(["", "TestAcronym"])(
		"should create OTU with acronym %j",
		async (acronym) => {
			const createOtu = mockCreateOtu(
				createFakeOtu({ name: "TestName", acronym }),
			);

			renderWithProviders(
				<OtuCreate open refId={reference.id} setOpen={vi.fn()} />,
			);

			await userEvent.type(screen.getByLabelText("Name"), "TestName");
			if (acronym) {
				await userEvent.type(screen.getByLabelText("Acronym"), acronym);
			}
			await userEvent.click(screen.getByRole("button", { name: "Save" }));

			await waitFor(() =>
				expect(createOtu).toHaveBeenCalledWith({
					data: {
						referenceId: reference.id,
						name: "TestName",
						acronym,
						schema: [],
					},
				}),
			);
		},
	);
});
