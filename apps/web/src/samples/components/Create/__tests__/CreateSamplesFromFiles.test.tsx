import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createFakeAccount } from "@tests/fake/account";
import { createFakeFile } from "@tests/fake/files";
import { createFakeLabel } from "@tests/fake/labels";
import { createFakeSubtractionNested } from "@tests/fake/subtractions";
import { mockListGroups } from "@tests/server-fn/groups";
import {
	mockCreateSample,
	sampleServerFnMocks,
} from "@tests/server-fn/samples";
import { mockListSubtractionsShortlist } from "@tests/server-fn/subtractions";
import { mockGetAccount } from "@tests/server-fn/users";
import { renderWithRouter } from "@tests/setup";
import type { Upload } from "@virtool/contracts";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CreateSamplesFromFiles from "../CreateSamplesFromFiles";

describe("<CreateSamplesFromFiles>", () => {
	const label = createFakeLabel();
	const labels = [label];
	const subtractionShortlist = createFakeSubtractionNested();

	beforeEach(() => {
		mockGetAccount(createFakeAccount({ primaryGroup: null }));
		mockListGroups([]);
		mockListSubtractionsShortlist([subtractionShortlist]);
	});

	async function renderDialog(selected: Upload[], onCreated = vi.fn()) {
		await renderWithRouter(
			<CreateSamplesFromFiles
				labels={labels}
				onCreated={onCreated}
				selected={selected}
			/>,
		);

		await userEvent.click(
			screen.getByRole("button", { name: "Create Samples" }),
		);

		expect(
			await screen.findByRole("heading", { name: "Create Samples" }),
		).toBeInTheDocument();

		return onCreated;
	}

	async function submitForm() {
		await userEvent.click(screen.getByRole("button", { name: "Save" }));
	}

	it("should make one row per selected file, prefilled with its name", async () => {
		const first = createFakeFile({ name: "sample_one.fastq.gz" });
		const second = createFakeFile({ name: "sample_two.fastq.gz" });

		await renderDialog([first, second]);

		expect(
			await screen.findByRole("textbox", {
				name: "Name for sample_one.fastq.gz",
			}),
		).toHaveValue("sample_one");
		expect(
			screen.getByRole("textbox", { name: "Name for sample_two.fastq.gz" }),
		).toHaveValue("sample_two");
		expect(screen.getAllByText("Unpaired")).toHaveLength(2);
	});

	it("should collapse a detected mate pair into one paired row", async () => {
		const left = createFakeFile({ name: "sample_one_R1.fastq.gz" });
		const right = createFakeFile({ name: "sample_one_R2.fastq.gz" });
		const lone = createFakeFile({ name: "sample_two.fastq.gz" });

		const createSample = mockCreateSample();

		await renderDialog([left, right, lone]);

		expect(
			await screen.findByRole("textbox", {
				name: "Name for sample_one_R1.fastq.gz",
			}),
		).toHaveValue("sample_one");
		expect(screen.getByText("Paired")).toBeInTheDocument();
		expect(screen.getByText("Unpaired")).toBeInTheDocument();

		await submitForm();

		await waitFor(() => expect(createSample).toHaveBeenCalledTimes(2));

		expect(createSample).toHaveBeenCalledWith({
			data: expect.objectContaining({
				name: "sample_one",
				files: [left.id, right.id],
			}),
		});
		expect(createSample).toHaveBeenCalledWith({
			data: expect.objectContaining({
				name: "sample_two",
				files: [lone.id],
			}),
		});
	});

	it("should create a sample whose mate isn't selected as unpaired", async () => {
		const left = createFakeFile({ name: "sample_one_R1.fastq.gz" });

		const createSample = mockCreateSample();

		await renderDialog([left]);

		expect(await screen.findByText("Unpaired")).toBeInTheDocument();

		await submitForm();

		await waitFor(() =>
			expect(createSample).toHaveBeenCalledWith({
				data: expect.objectContaining({
					name: "sample_one_R1",
					files: [left.id],
				}),
			}),
		);
	});

	it("should apply the shared fields to every sample in the batch", async () => {
		const first = createFakeFile({ name: "sample_one.fastq.gz" });
		const second = createFakeFile({ name: "sample_two.fastq.gz" });

		const createSample = mockCreateSample();

		await renderDialog([first, second]);

		await userEvent.click(
			await screen.findByRole("button", { name: "Show Metadata Fields" }),
		);
		await userEvent.type(await screen.findByLabelText("Isolate"), "Clone AB");
		await userEvent.type(screen.getByLabelText("Host"), "Apple");
		await userEvent.type(screen.getByLabelText("Locale"), "Earth");

		await userEvent.click(
			screen.getByRole("button", { name: "Toggle Labels menu" }),
		);
		await userEvent.click(screen.getByRole("option", { name: label.name }));

		await userEvent.click(
			screen.getByRole("button", { name: "Toggle Default Subtractions menu" }),
		);
		await userEvent.click(
			screen.getByRole("option", { name: subtractionShortlist.name }),
		);

		await submitForm();

		await waitFor(() => expect(createSample).toHaveBeenCalledTimes(2));

		for (const name of ["sample_one", "sample_two"]) {
			expect(createSample).toHaveBeenCalledWith({
				data: expect.objectContaining({
					name,
					isolate: "Clone AB",
					host: "Apple",
					locale: "Earth",
					labels: [label.id],
					subtractions: [subtractionShortlist.id],
				}),
			});
		}
	});

	it("should submit an edited name", async () => {
		const file = createFakeFile({ name: "sample_one.fastq.gz" });

		const createSample = mockCreateSample();

		await renderDialog([file]);

		const field = await screen.findByRole("textbox", {
			name: "Name for sample_one.fastq.gz",
		});
		await userEvent.clear(field);
		await userEvent.type(field, "Sample A");

		await submitForm();

		await waitFor(() =>
			expect(createSample).toHaveBeenCalledWith({
				data: expect.objectContaining({ name: "Sample A", files: [file.id] }),
			}),
		);
	});

	it("should not create a sample for a removed row", async () => {
		const first = createFakeFile({ name: "sample_one.fastq.gz" });
		const second = createFakeFile({ name: "sample_two.fastq.gz" });

		const createSample = mockCreateSample();

		await renderDialog([first, second]);

		await userEvent.click(
			await screen.findByRole("button", { name: "Remove sample_one.fastq.gz" }),
		);

		expect(
			screen.queryByRole("textbox", { name: "Name for sample_one.fastq.gz" }),
		).not.toBeInTheDocument();

		await submitForm();

		await waitFor(() => expect(createSample).toHaveBeenCalledTimes(1));
		expect(createSample).toHaveBeenCalledWith({
			data: expect.objectContaining({ name: "sample_two" }),
		});
	});

	it("should require a name for every row", async () => {
		const file = createFakeFile({ name: "sample_one.fastq.gz" });

		const createSample = mockCreateSample();

		await renderDialog([file]);

		await userEvent.clear(
			await screen.findByRole("textbox", {
				name: "Name for sample_one.fastq.gz",
			}),
		);

		await submitForm();

		expect(await screen.findByText("Required Field")).toBeInTheDocument();
		expect(createSample).not.toHaveBeenCalled();
	});

	it("should keep only the failed rows when part of the batch fails", async () => {
		const first = createFakeFile({ name: "sample_one.fastq.gz" });
		const second = createFakeFile({ name: "sample_two.fastq.gz" });

		sampleServerFnMocks.createSampleFn.mockImplementation(
			async ({ data }: { data: { files: number[] } }) => {
				if (data.files[0] === second.id) {
					throw new Error("Name is already in use");
				}
				return {};
			},
		);

		const onCreated = await renderDialog([first, second]);

		await submitForm();

		expect(
			await screen.findByText("1 sample could not be created."),
		).toBeInTheDocument();

		// The created sample's reads are reserved, so its row is gone and the
		// selection it came from was cleared.
		expect(onCreated).toHaveBeenCalled();
		expect(
			screen.queryByRole("textbox", { name: "Name for sample_one.fastq.gz" }),
		).not.toBeInTheDocument();
		expect(
			screen.getByRole("textbox", { name: "Name for sample_two.fastq.gz" }),
		).toHaveValue("sample_two");
	});
});
