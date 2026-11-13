import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createFakeSubtraction } from "@tests/fake/subtractions";
import { mockUpdateSubtraction } from "@tests/server-fn/subtractions";
import { renderWithProviders } from "@tests/setup";
import type { ComponentProps } from "react";
import { beforeEach, describe, expect, it } from "vitest";
import EditSubtraction from "../EditSubtraction";

describe("<EditSubtraction />", () => {
	const subtraction = createFakeSubtraction();
	let props: ComponentProps<typeof EditSubtraction>;

	beforeEach(() => {
		props = { subtraction };
	});

	it("should update subtraction and close dialog when form is submitted", async () => {
		const updateSubtraction = mockUpdateSubtraction(subtraction);
		renderWithProviders(<EditSubtraction {...props} />);

		await userEvent.click(screen.getByRole("button", { name: "modify" }));

		const nameInput = screen.getByLabelText("Name");
		expect(nameInput).toHaveValue(subtraction.name);
		expect(screen.getByLabelText("Nickname")).toHaveValue(subtraction.nickname);
		await userEvent.clear(nameInput);
		await userEvent.type(nameInput, "newName");

		const nicknameInput = screen.getByLabelText("Nickname");
		await userEvent.clear(nicknameInput);
		await userEvent.type(nicknameInput, "newNickname");

		await userEvent.click(screen.getByText("Save"));

		await waitFor(() => expect(screen.queryByLabelText("Name")).toBeNull());
		expect(updateSubtraction).toHaveBeenCalledWith({
			data: {
				subtractionId: subtraction.id,
				name: "newName",
				nickname: "newNickname",
			},
		});
	});
});
