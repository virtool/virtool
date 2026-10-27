import CopyField from "@base/CopyField";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

describe("<CopyField />", () => {
	it("copies the value and reports success", async () => {
		const user = userEvent.setup();
		const clipboard = vi.spyOn(navigator.clipboard, "writeText");
		const onCopy = vi.fn();
		render(
			<CopyField label="Link" value="https://example.com" onCopy={onCopy} />,
		);

		expect(screen.getByRole("textbox", { name: "Link" })).toHaveValue(
			"https://example.com",
		);
		await user.click(screen.getByRole("button", { name: "Copy" }));

		expect(clipboard).toHaveBeenLastCalledWith("https://example.com");
		expect(screen.getByRole("status")).toHaveTextContent(
			"Copied to clipboard.",
		);
		expect(onCopy).toHaveBeenCalledOnce();
	});

	it("tells the user to copy by hand when the write fails", async () => {
		const user = userEvent.setup();
		const onCopy = vi.fn();
		render(<CopyField label="Link" value="secret" onCopy={onCopy} />);
		vi.spyOn(navigator.clipboard, "writeText").mockRejectedValueOnce(
			new Error("denied"),
		);

		await user.click(screen.getByRole("button", { name: "Copy" }));

		expect(screen.getByRole("status")).toHaveTextContent(
			"Could not copy. Select the text and copy it manually.",
		);
		expect(onCopy).not.toHaveBeenCalled();
	});

	it("clears the status when the value changes", async () => {
		const user = userEvent.setup();
		const { rerender } = render(<CopyField label="Link" value="first" />);

		await user.click(screen.getByRole("button", { name: "Copy" }));
		expect(screen.getByRole("status")).toHaveTextContent(
			"Copied to clipboard.",
		);

		rerender(<CopyField label="Link" value="second" />);
		expect(screen.getByRole("status")).toBeEmptyDOMElement();
	});
});
