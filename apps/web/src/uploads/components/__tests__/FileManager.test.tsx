import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createFakeAccount } from "@tests/fake/account";
import { createFakeFile } from "@tests/fake/files";
import { mockFindUploads, uploadServerFnMocks } from "@tests/server-fn/uploads";
import { mockGetAccount } from "@tests/server-fn/users";
import { renderWithRouter } from "@tests/setup";
import { upload } from "@uploads/uploader";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FileManager, type FileManagerProps } from "../FileManager";

describe("<FileManager>", () => {
	let props: FileManagerProps;
	let path: string;

	afterEach(() => {
		vi.restoreAllMocks();
	});

	beforeEach(() => {
		props = {
			accept: {
				"application/gzip": [".fasta.gz", ".fa.gz", ".fastq.gz", ".fq.gz"],
			},
			fileType: "reads",
		};
		path = "/samples/uploads?page=1";
	});

	it("should upload with validation based on passed regex", async () => {
		mockGetAccount(
			createFakeAccount({
				administratorRole: null,
				permissions: {
					cancel_job: false,
					create_ref: false,
					create_sample: false,
					modify_hmm: false,
					modify_subtraction: false,
					remove_file: false,
					remove_job: false,
					upload_file: true,
				},
			}),
		);
		mockFindUploads([createFakeFile({ name: "subtraction.fq.gz" })]);

		vi.mock("@uploads/uploader");

		await renderWithRouter(
			<FileManager {...props} regex={/.(?:fa|fasta)(?:.gz|.gzip)?$/} />,
			path,
		);

		expect(
			await screen.findByText("Drag files here to upload"),
		).toBeInTheDocument();
		expect(screen.getByText("subtraction.fq.gz")).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: "Browse Files" }),
		).toBeInTheDocument();

		const invalidFile = new File(["test"], "test_invalid_file.gz", {
			type: "application/gzip",
		});
		const validFile = new File(["test"], "test_valid_file.fa.gz", {
			type: "application/gzip",
		});

		await userEvent.upload(await screen.findByLabelText("Upload file"), [
			invalidFile,
			validFile,
		]);

		await waitFor(() => {
			expect(upload).toHaveBeenCalledTimes(1);
			expect(upload).toHaveBeenCalledWith(validFile, props.fileType);
		});
	});

	it("should hide upload bar if user lacks permission", async () => {
		mockGetAccount(createFakeAccount({ administratorRole: null }));
		mockFindUploads([createFakeFile({ name: "subtraction.fq.gz" })]);

		await renderWithRouter(<FileManager {...props} />, path);

		expect(
			await screen.findByText("You do not have permission to upload files."),
		).toBeInTheDocument();
		expect(
			screen.queryByRole("button", { name: "Upload" }),
		).not.toBeInTheDocument();
	});

	it("should show the hint under the upload prompt", async () => {
		mockGetAccount(
			createFakeAccount({
				administratorRole: "full",
			}),
		);
		mockFindUploads([createFakeFile({ name: "subtraction.fq.gz" })]);

		await renderWithRouter(
			<FileManager {...props} hint="Supports plain or gzipped FASTA" />,
			path,
		);

		expect(
			await screen.findByText("Supports plain or gzipped FASTA"),
		).toBeInTheDocument();
		expect(screen.getByText("Drag files here to upload")).toBeInTheDocument();
	});

	describe("selection", () => {
		it("should delete every selected file", async () => {
			const first = createFakeFile({ name: "one.fq.gz" });
			const second = createFakeFile({ name: "two.fq.gz" });
			const unselected = createFakeFile({ name: "three.fq.gz" });
			const files = [first, second, unselected];

			mockGetAccount(createFakeAccount({ administratorRole: "full" }));
			mockFindUploads(files);
			uploadServerFnMocks.deleteUploadFn.mockResolvedValue(null);

			await renderWithRouter(<FileManager {...props} />, path);

			expect(await screen.findByText("3 files")).toBeInTheDocument();

			await userEvent.click(
				screen.getByRole("checkbox", { name: "Select one.fq.gz" }),
			);
			await userEvent.click(
				screen.getByRole("checkbox", { name: "Select two.fq.gz" }),
			);

			expect(screen.getByText("2 selected")).toBeInTheDocument();

			await userEvent.click(screen.getByRole("button", { name: "Delete" }));

			await waitFor(() => {
				expect(uploadServerFnMocks.deleteUploadFn).toHaveBeenCalledWith({
					data: { id: first.id },
				});
				expect(uploadServerFnMocks.deleteUploadFn).toHaveBeenCalledWith({
					data: { id: second.id },
				});
			});

			expect(uploadServerFnMocks.deleteUploadFn).not.toHaveBeenCalledWith({
				data: { id: unselected.id },
			});
		});

		it("should select and deselect every file on the page", async () => {
			const files = [
				createFakeFile({ name: "one.fq.gz" }),
				createFakeFile({ name: "two.fq.gz" }),
			];

			mockGetAccount(createFakeAccount({ administratorRole: "full" }));
			mockFindUploads(files);

			await renderWithRouter(<FileManager {...props} />, path);

			const selectAll = await screen.findByRole("checkbox", {
				name: "Select all files",
			});

			await userEvent.click(selectAll);
			expect(screen.getByText("2 selected")).toBeInTheDocument();

			await userEvent.click(selectAll);
			expect(screen.getByText("2 files")).toBeInTheDocument();
			expect(
				screen.queryByRole("button", { name: "Delete" }),
			).not.toBeInTheDocument();
		});

		it("should hide checkboxes when there is nothing to do with a selection", async () => {
			mockGetAccount(createFakeAccount({ administratorRole: null }));
			mockFindUploads([createFakeFile({ name: "one.fq.gz" })]);

			await renderWithRouter(<FileManager {...props} />, path);

			expect(await screen.findByText("one.fq.gz")).toBeInTheDocument();
			expect(
				screen.queryByRole("checkbox", { name: "Select all files" }),
			).not.toBeInTheDocument();
			expect(
				screen.queryByRole("checkbox", { name: "Select one.fq.gz" }),
			).not.toBeInTheDocument();
		});
	});
});
