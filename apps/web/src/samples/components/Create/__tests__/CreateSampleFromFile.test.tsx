import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createFakeAccount } from "@tests/fake/account";
import { createFakeFile } from "@tests/fake/files";
import { createFakeLabel } from "@tests/fake/labels";
import { createFakeShortlistSubtraction } from "@tests/fake/subtractions";
import { mockListGroups } from "@tests/server-fn/groups";
import { mockCreateSample } from "@tests/server-fn/samples";
import { mockListSubtractionsShortlist } from "@tests/server-fn/subtractions";
import { mockGetAccount } from "@tests/server-fn/users";
import { renderWithRouter } from "@tests/setup";
import type { Upload } from "@uploads/types";
import nock from "nock";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import CreateSampleFromFile from "../CreateSampleFromFile";

describe("<CreateSampleFromFile>", () => {
	const label = createFakeLabel();
	const labels = [label];
	const subtractionShortlist = createFakeShortlistSubtraction();

	beforeEach(() => {
		mockGetAccount(createFakeAccount({ primary_group: null }));
		mockListGroups([]);
		mockListSubtractionsShortlist([subtractionShortlist]);
	});

	afterEach(() => nock.cleanAll());

	async function renderDialog(upload: Upload, uploads: Upload[]) {
		await renderWithRouter(
			<CreateSampleFromFile
				labels={labels}
				upload={upload}
				uploads={uploads}
			/>,
		);

		await userEvent.click(
			screen.getByRole("button", { name: "create sample" }),
		);

		expect(await screen.findByText("Create Sample")).toBeInTheDocument();
	}

	async function submitForm() {
		await userEvent.click(screen.getByRole("button", { name: "Save" }));
	}

	it("should prefill an editable name from the file", async () => {
		const file = createFakeFile({ name: "sample_one.fastq.gz" });

		await renderDialog(file, [file]);

		const field = await screen.findByRole("textbox", { name: "Name" });
		expect(field).toHaveValue("sample_one");

		await userEvent.clear(field);
		await userEvent.type(field, "Sample A");
		expect(field).toHaveValue("Sample A");
	});

	it("should fix the read selection to the file", async () => {
		const file = createFakeFile({ name: "sample_one.fastq.gz" });
		const other = createFakeFile({ name: "sample_two.fastq.gz" });

		await renderDialog(file, [file, other]);

		expect(await screen.findByText("sample_one.fastq.gz")).toBeInTheDocument();
		expect(screen.getByText("Unpaired")).toBeInTheDocument();

		// The other file can't be picked here.
		expect(screen.queryByText("sample_two.fastq.gz")).not.toBeInTheDocument();
		expect(
			screen.queryByRole("button", { name: "Reset" }),
		).not.toBeInTheDocument();
	});

	it("should include the mate of a paired file", async () => {
		const left = createFakeFile({ name: "sample_one_R1.fastq.gz" });
		const right = createFakeFile({ name: "sample_one_R2.fastq.gz" });

		const createSample = mockCreateSample();

		await renderDialog(right, [left, right]);

		expect(await screen.findByRole("textbox", { name: "Name" })).toHaveValue(
			"sample_one",
		);
		expect(screen.getByText("sample_one_R1.fastq.gz")).toBeInTheDocument();
		expect(screen.getByText("sample_one_R2.fastq.gz")).toBeInTheDocument();
		expect(screen.getByText("Paired")).toBeInTheDocument();

		await submitForm();

		await waitFor(() =>
			expect(createSample).toHaveBeenCalledWith({
				data: expect.objectContaining({
					name: "sample_one",
					files: [left.id, right.id],
				}),
			}),
		);
	});

	it("should submit with labels and subtractions", async () => {
		const file = createFakeFile({ name: "sample_one.fastq.gz" });

		const createSample = mockCreateSample();

		await renderDialog(file, [file]);

		const field = await screen.findByRole("textbox", { name: "Name" });
		await userEvent.clear(field);
		await userEvent.type(field, "Sample A");

		await userEvent.click(
			screen.getByRole("button", { name: "Show Metadata Fields" }),
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

		await waitFor(() =>
			expect(createSample).toHaveBeenCalledWith({
				data: expect.objectContaining({
					name: "Sample A",
					isolate: "Clone AB",
					host: "Apple",
					locale: "Earth",
					files: [file.id],
					labels: [label.id],
					subtractions: [subtractionShortlist.id],
				}),
			}),
		);
	});
});
