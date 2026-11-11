import { IconButton } from "@base/Icon";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@tests/setup";
import { CLIENT_ERROR_NAME } from "@virtool/contracts";
import { Trash } from "lucide-react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import DeleteDialog from "../DeleteDialog";

// A ClientError as it arrives rebuilt by `serverErrorSerializationAdapter`.
function clientError(message: string): Error {
	const error = new Error(message);
	error.name = CLIENT_ERROR_NAME;
	return error;
}

describe("<DeleteDialog />", () => {
	it("titles the dialog and prompts with the item name", () => {
		renderWithProviders(
			<DeleteDialog name="Foo" noun="Sample" onConfirm={vi.fn()} open />,
		);

		expect(screen.getByText("Delete Sample")).toBeInTheDocument();
		expect(
			screen.getByText(/are you sure you want to delete/i),
		).toBeInTheDocument();
		expect(screen.getByText("Foo")).toBeInTheDocument();
	});

	it("takes a custom title and confirm label", () => {
		renderWithProviders(
			<DeleteDialog
				confirmLabel="Sign out"
				name="Firefox"
				noun="session"
				onConfirm={vi.fn()}
				open
				title="Sign out session"
			/>,
		);

		expect(screen.getByText("Sign out session")).toBeInTheDocument();
		expect(screen.queryByText("Delete session")).toBeNull();
		expect(
			screen.getByRole("button", { name: "Sign out" }),
		).toBeInTheDocument();
		expect(screen.queryByRole("button", { name: "Confirm" })).toBeNull();
	});

	it("opens from its trigger", async () => {
		renderWithProviders(
			<DeleteDialog
				name="Foo"
				noun="Sample"
				onConfirm={vi.fn()}
				trigger={<button type="button">open</button>}
			/>,
		);

		expect(screen.queryByText("Delete Sample")).toBeNull();

		await userEvent.click(screen.getByRole("button", { name: "open" }));

		expect(screen.getByText("Delete Sample")).toBeInTheDocument();
	});

	it("runs onConfirm and closes on success", async () => {
		const onConfirm = vi.fn().mockResolvedValue(undefined);
		const onOpenChange = vi.fn();
		renderWithProviders(
			<DeleteDialog
				name="Foo"
				noun="Sample"
				onConfirm={onConfirm}
				onOpenChange={onOpenChange}
				open
			/>,
		);

		await userEvent.click(screen.getByRole("button", { name: "Confirm" }));

		await waitFor(() => expect(onConfirm).toHaveBeenCalledOnce());
		expect(onOpenChange).toHaveBeenCalledWith(false);
	});

	it("renders the error and stays open when onConfirm rejects", async () => {
		const onConfirm = vi
			.fn()
			.mockRejectedValue(clientError("Cannot delete this."));
		renderWithProviders(
			<DeleteDialog name="Foo" noun="Sample" onConfirm={onConfirm} open />,
		);

		await userEvent.click(screen.getByRole("button", { name: "Confirm" }));

		expect(await screen.findByRole("alert")).toHaveTextContent(
			"Cannot delete this.",
		);
		expect(screen.getByText("Delete Sample")).toBeInTheDocument();
	});

	it("stays open without an error when recent authentication is cancelled", async () => {
		const cancelled = new Error("Recent authentication was cancelled.");
		cancelled.name = "RecentAuthenticationCancelled";
		const onConfirm = vi.fn().mockRejectedValue(cancelled);
		const onOpenChange = vi.fn();
		renderWithProviders(
			<DeleteDialog
				name="Foo"
				noun="Sample"
				onConfirm={onConfirm}
				onOpenChange={onOpenChange}
				open
			/>,
		);

		await userEvent.click(screen.getByRole("button", { name: "Confirm" }));

		await waitFor(() => expect(onConfirm).toHaveBeenCalledOnce());
		expect(screen.queryByRole("alert")).toBeNull();
		expect(onOpenChange).not.toHaveBeenCalled();
	});

	it("closes without confirming when cancelled", async () => {
		const onConfirm = vi.fn();
		const onOpenChange = vi.fn();
		renderWithProviders(
			<DeleteDialog
				name="Foo"
				noun="Sample"
				onConfirm={onConfirm}
				onOpenChange={onOpenChange}
				open
			/>,
		);

		await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

		expect(onConfirm).not.toHaveBeenCalled();
		expect(onOpenChange).toHaveBeenCalledWith(false);
	});

	it("runs onConfirm once and blocks dismissal while it is pending", async () => {
		const user = userEvent.setup();
		const deletion = Promise.withResolvers<void>();
		const onConfirm = vi.fn().mockReturnValue(deletion.promise);
		const onOpenChange = vi.fn();
		renderWithProviders(
			<DeleteDialog
				name="Foo"
				noun="Sample"
				onConfirm={onConfirm}
				onOpenChange={onOpenChange}
				open
			/>,
		);

		const confirm = screen.getByRole("button", { name: "Confirm" });

		await user.dblClick(confirm);
		await user.keyboard("{Escape}");

		expect(onConfirm).toHaveBeenCalledOnce();
		expect(confirm).toBeDisabled();
		expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
		expect(onOpenChange).not.toHaveBeenCalled();

		deletion.resolve();

		await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
	});

	it("allows another confirm after onConfirm rejects", async () => {
		const user = userEvent.setup();
		const onConfirm = vi
			.fn()
			.mockRejectedValueOnce(clientError("Cannot delete this."))
			.mockResolvedValueOnce(undefined);
		renderWithProviders(
			<DeleteDialog name="Foo" noun="Sample" onConfirm={onConfirm} open />,
		);

		await user.click(screen.getByRole("button", { name: "Confirm" }));
		await screen.findByRole("alert");

		const confirm = screen.getByRole("button", { name: "Confirm" });

		expect(confirm).toBeEnabled();

		await user.click(confirm);

		expect(onConfirm).toHaveBeenCalledTimes(2);
	});

	it("returns focus to its trigger when closed", async () => {
		const user = userEvent.setup();
		renderWithProviders(
			<DeleteDialog
				name="Foo"
				noun="Sample"
				onConfirm={vi.fn()}
				trigger={<IconButton IconComponent={Trash} color="red" tip="Delete" />}
			/>,
		);

		const trigger = screen.getByRole("button", { name: "Delete" });

		await user.click(trigger);
		await user.click(screen.getByRole("button", { name: "Cancel" }));

		await waitFor(() => expect(trigger).toHaveFocus());
	});

	it("returns focus to the opener of a controlled dialog when closed", async () => {
		const user = userEvent.setup();

		function Controlled() {
			const [open, setOpen] = useState(false);

			return (
				<>
					<button type="button" onClick={() => setOpen(true)}>
						Remove
					</button>
					<DeleteDialog
						name="Foo"
						noun="Sample"
						onConfirm={vi.fn()}
						onOpenChange={setOpen}
						open={open}
					/>
				</>
			);
		}

		renderWithProviders(<Controlled />);

		const opener = screen.getByRole("button", { name: "Remove" });

		await user.click(opener);
		await user.keyboard("{Escape}");

		await waitFor(() => expect(opener).toHaveFocus());
	});
});
