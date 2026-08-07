import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { uploadServerFnMocks } from "@tests/server-fn/uploads";
import { renderWithProviders } from "@tests/setup";
import { beforeEach, describe, expect, it, vi } from "vitest";
import UploadItem, { type UploadItemProps } from "../UploadItem.js";

vi.mock("@administration/utils.ts");

describe("<UploadItem />", () => {
	let props: UploadItemProps;

	beforeEach(() => {
		props = {
			canDelete: true,
			id: 1,
			name: "foo.fa",
			size: 10,
			uploadedAt: new Date("2018-02-14T17:12:00.000000Z"),
			user: { id: 1, handle: "bill" },
		};
	});

	it("should render", () => {
		const user = { id: 1, handle: "bill" };
		renderWithProviders(<UploadItem {...props} user={user} />);

		expect(screen.getByText(new RegExp(user.handle))).toBeInTheDocument();
		expect(screen.getByText(new RegExp(props.name))).toBeInTheDocument();
		expect(screen.getByText("10.0 B")).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "remove" })).toBeInTheDocument();
	});

	it("should render when [user=null]", () => {
		props.user = null;

		renderWithProviders(<UploadItem {...props} />);

		expect(screen.getByText(/Retrieved/)).toBeInTheDocument();
		expect(screen.getByText(new RegExp(props.name))).toBeInTheDocument();
		expect(screen.getByText("10.0 B")).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "remove" })).toBeInTheDocument();
	});

	it("should link to the download route, named after the file", () => {
		renderWithProviders(<UploadItem {...props} />);

		const link = screen.getByRole("link", { name: `Download ${props.name}` });

		expect(link).toHaveAttribute("href", `/uploads/${props.id}`);
		expect(link).toHaveAttribute("download", props.name);
	});

	// Downloading is not gated on the delete permission — every signed-in user
	// can already list the files.
	it("should render the download link when [canDelete=false]", () => {
		props.canDelete = false;

		renderWithProviders(<UploadItem {...props} />);

		expect(
			screen.getByRole("link", { name: `Download ${props.name}` }),
		).toBeInTheDocument();
		expect(
			screen.queryByRole("button", { name: "remove" }),
		).not.toBeInTheDocument();
	});

	it("should have [props.onRemove] called when trash icon clicked", async () => {
		uploadServerFnMocks.deleteUploadFn.mockResolvedValue(null);
		renderWithProviders(<UploadItem {...props} />);

		await userEvent.click(screen.getByRole("button", { name: "remove" }));

		await waitFor(() => {
			expect(uploadServerFnMocks.deleteUploadFn).toHaveBeenCalledWith({
				data: { id: props.id },
			});
		});
	});
});
