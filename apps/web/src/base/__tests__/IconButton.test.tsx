import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Pencil } from "lucide-react";
import { describe, expect, it, vi } from "vitest";
import { IconButton } from "../Icon";

describe("IconButton", () => {
	it("renders the gray variant at text-gray-500 so it meets non-text contrast", () => {
		render(<IconButton IconComponent={Pencil} color="gray" tip="edit" />);
		const button = screen.getByRole("button", { name: "edit" });
		expect(button).toHaveClass("text-gray-500");
		expect(button).not.toHaveClass("text-gray-400");
	});

	it("defaults to the black variant", () => {
		render(<IconButton IconComponent={Pencil} tip="edit" />);
		expect(screen.getByRole("button", { name: "edit" })).toHaveClass(
			"text-black",
		);
	});

	it("uses a white icon and focus ring on a dark background", () => {
		render(<IconButton IconComponent={Pencil} tip="About" onDark />);
		const button = screen.getByRole("button", { name: "About" });
		expect(button).toHaveClass("text-white");
		expect(button).toHaveClass("focus-visible:ring-white");
	});

	it("lets onDark override an explicit color", () => {
		render(
			<IconButton IconComponent={Pencil} color="blue" tip="About" onDark />,
		);
		const button = screen.getByRole("button", { name: "About" });
		expect(button).toHaveClass("text-white");
		expect(button).not.toHaveClass("text-blue-500");
	});

	it("calls onClick when clicked", async () => {
		const onClick = vi.fn();
		render(<IconButton IconComponent={Pencil} tip="edit" onClick={onClick} />);
		await userEvent.click(screen.getByRole("button", { name: "edit" }));
		expect(onClick).toHaveBeenCalledOnce();
	});

	it("merges a provided className with the variant classes", () => {
		render(
			<IconButton
				IconComponent={Pencil}
				tip="edit"
				className="my-extra-class"
			/>,
		);
		const button = screen.getByRole("button", { name: "edit" });
		expect(button).toHaveClass("text-black");
		expect(button).toHaveClass("my-extra-class");
	});

	it("uses ariaLabel over tip for the accessible name", () => {
		render(
			<IconButton IconComponent={Pencil} tip="edit" ariaLabel="edit item" />,
		);
		expect(
			screen.getByRole("button", { name: "edit item" }),
		).toBeInTheDocument();
	});
});
