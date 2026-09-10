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
		await userEvent.click(
			screen.getByRole("button", { name: /^Create \d+ samples?$/ }),
		);
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
		expect(screen.getByText("2 samples")).toBeInTheDocument();
	});

	it("should preserve the draft when the dialog closes and reopens", async () => {
		await renderDialog([createFakeFile({ name: "sample_one.fastq.gz" })]);

		const name = screen.getByRole("textbox", {
			name: "Name for sample_one.fastq.gz",
		});
		await userEvent.clear(name);
		await userEvent.type(name, "Edited sample");
		await userEvent.type(
			screen.getByRole("textbox", { name: "Match text" }),
			"sample",
		);
		await userEvent.type(
			screen.getByRole("textbox", { name: "Replacement" }),
			"specimen",
		);
		await userEvent.click(
			screen.getByRole("button", { name: "Show Metadata Fields" }),
		);

		await userEvent.keyboard("{Escape}");

		expect(
			screen.queryByRole("heading", { name: "Create Samples" }),
		).not.toBeInTheDocument();
		await userEvent.click(
			screen.getByRole("button", { name: "Create Samples" }),
		);

		expect(
			screen.getByRole("textbox", {
				name: "Name for sample_one.fastq.gz",
			}),
		).toHaveValue("Edited sample");
		expect(screen.getByRole("textbox", { name: "Match text" })).toHaveValue(
			"sample",
		);
		expect(screen.getByRole("textbox", { name: "Replacement" })).toHaveValue(
			"specimen",
		);
		expect(screen.getByLabelText("Host")).toBeVisible();
	});

	it("should stay open while samples are being created", async () => {
		let resolveCreate: ((value: object) => void) | undefined;
		sampleServerFnMocks.createSampleFn.mockImplementation(
			() =>
				new Promise((resolve) => {
					resolveCreate = resolve;
				}),
		);
		await renderDialog([createFakeFile({ name: "sample_one.fastq.gz" })]);

		await submitForm();

		expect(
			screen.getByRole("button", { name: "Creating 1 sample…" }),
		).toBeDisabled();
		await userEvent.keyboard("{Escape}");
		expect(
			screen.getByRole("heading", { name: "Create Samples" }),
		).toBeInTheDocument();

		resolveCreate?.({});
		await waitFor(() =>
			expect(
				screen.queryByRole("heading", { name: "Create Samples" }),
			).not.toBeInTheDocument(),
		);
	});

	it("should scroll the rows without scrolling the bulk rename controls", async () => {
		await renderDialog([
			createFakeFile({ name: "sample_one.fastq.gz" }),
			createFakeFile({ name: "sample_two.fastq.gz" }),
		]);

		const table = screen.getByRole("table", { name: "Samples" });
		const scrollContainer = table.parentElement;
		const bulkRename = screen.getByRole("group", { name: "Bulk rename" });

		expect(scrollContainer).toHaveClass("overflow-y-auto");
		expect(scrollContainer).not.toContainElement(bulkRename);
		expect(table.querySelector("thead")).toHaveClass("sticky", "top-0");
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
		expect(
			screen.getByRole("textbox", { name: "Name for sample_one.fastq.gz" }),
		).toHaveValue("Sample A");

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

	it("should highlight trimmed duplicate names and allow submission after editing", async () => {
		const first = createFakeFile({ name: "sample_one.fastq.gz" });
		const second = createFakeFile({ name: "sample_two.fastq.gz" });
		const createSample = mockCreateSample();

		await renderDialog([first, second]);

		const firstName = screen.getByRole("textbox", {
			name: "Name for sample_one.fastq.gz",
		});
		const secondName = screen.getByRole("textbox", {
			name: "Name for sample_two.fastq.gz",
		});
		await userEvent.clear(secondName);
		await userEvent.type(secondName, " sample_one ");

		expect(firstName).toHaveAttribute("aria-invalid", "true");
		expect(secondName).toHaveAttribute("aria-invalid", "true");
		expect(screen.getAllByText("Duplicate sample name")).toHaveLength(2);
		expect(
			screen.getByRole("button", { name: /^Create \d+ samples?$/ }),
		).toBeDisabled();
		await submitForm();
		expect(createSample).not.toHaveBeenCalled();

		await userEvent.clear(secondName);
		await userEvent.type(secondName, "unique");

		expect(screen.queryByText("Duplicate sample name")).not.toBeInTheDocument();
		expect(firstName).not.toHaveAttribute("aria-invalid", "true");
		expect(secondName).not.toHaveAttribute("aria-invalid", "true");
		expect(
			screen.getByRole("button", { name: /^Create \d+ samples?$/ }),
		).toBeEnabled();

		await submitForm();
		await waitFor(() => expect(createSample).toHaveBeenCalledTimes(2));
	});

	it("should clear duplicate errors and update the count when a row is removed", async () => {
		await renderDialog([
			createFakeFile({ name: "sample.fastq.gz" }),
			createFakeFile({ name: "sample.fq.gz" }),
		]);

		expect(screen.getByText("2 samples")).toBeInTheDocument();
		expect(screen.getAllByText("Duplicate sample name")).toHaveLength(2);
		expect(
			screen.getByRole("button", { name: /^Create \d+ samples?$/ }),
		).toBeDisabled();

		await userEvent.click(
			screen.getByRole("button", { name: "Remove sample.fastq.gz" }),
		);

		expect(screen.getByText("1 sample")).toBeInTheDocument();
		expect(screen.queryByText("Duplicate sample name")).not.toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: /^Create \d+ samples?$/ }),
		).toBeEnabled();
	});

	it("should reset an edited name to its own initial value after removing another row", async () => {
		await renderDialog([
			createFakeFile({ name: "sample_one.fastq.gz" }),
			createFakeFile({ name: "sample_two.fastq.gz" }),
		]);

		expect(
			screen.queryByRole("button", {
				name: "Reset name for sample_two.fastq.gz",
			}),
		).not.toBeInTheDocument();
		const name = screen.getByRole("textbox", {
			name: "Name for sample_two.fastq.gz",
		});
		await userEvent.clear(name);
		await userEvent.type(name, "Edited");
		await userEvent.click(
			screen.getByRole("button", { name: "Remove sample_one.fastq.gz" }),
		);
		await userEvent.click(
			screen.getByRole("button", {
				name: "Reset name for sample_two.fastq.gz",
			}),
		);

		expect(
			screen.getByRole("textbox", {
				name: "Name for sample_two.fastq.gz",
			}),
		).toHaveValue("sample_two");
		expect(
			screen.queryByRole("button", {
				name: "Reset name for sample_two.fastq.gz",
			}),
		).not.toBeInTheDocument();
	});

	it("should delete wildcard matches from every name and guard the resulting duplicates", async () => {
		await renderDialog([
			createFakeFile({ name: "sample_batch-one_end.fastq.gz" }),
			createFakeFile({ name: "sample_batch_end.fastq.gz" }),
		]);

		await userEvent.type(
			screen.getByRole("textbox", { name: "Match text" }),
			"_batch*_end",
		);
		await userEvent.click(
			screen.getByRole("button", { name: /^Replace in \d+ names?$/ }),
		);

		expect(
			screen.getByRole("textbox", {
				name: "Name for sample_batch-one_end.fastq.gz",
			}),
		).toHaveValue("sample");
		expect(
			screen.getByRole("textbox", {
				name: "Name for sample_batch_end.fastq.gz",
			}),
		).toHaveValue("sample");
		expect(screen.getAllByText("Duplicate sample name")).toHaveLength(2);
		expect(
			screen.getByRole("button", { name: /^Create \d+ samples?$/ }),
		).toBeDisabled();
	});

	it("should replace all literal matches with literal replacement text", async () => {
		await renderDialog([
			createFakeFile({ name: "sample.a+.a+.fastq.gz" }),
			createFakeFile({ name: "sample.A+.fastq.gz" }),
		]);

		await userEvent.type(
			screen.getByRole("textbox", { name: "Match text" }),
			".a+",
		);
		await userEvent.type(
			screen.getByRole("textbox", { name: "Replacement" }),
			"$&",
		);
		await userEvent.click(
			screen.getByRole("button", { name: /^Replace in \d+ names?$/ }),
		);

		expect(
			screen.getByRole("textbox", {
				name: "Name for sample.a+.a+.fastq.gz",
			}),
		).toHaveValue("sample$&$&");
		expect(
			screen.getByRole("textbox", {
				name: "Name for sample.A+.fastq.gz",
			}),
		).toHaveValue("sample.A+");
	});

	it("should undo the last bulk rename", async () => {
		await renderDialog([
			createFakeFile({ name: "sample_one.fastq.gz" }),
			createFakeFile({ name: "sample_two.fastq.gz" }),
		]);

		await userEvent.type(
			screen.getByRole("textbox", { name: "Match text" }),
			"sample_",
		);
		await userEvent.click(
			screen.getByRole("button", { name: "Replace in 2 names" }),
		);

		expect(
			screen.getByRole("textbox", { name: "Name for sample_one.fastq.gz" }),
		).toHaveValue("one");
		await userEvent.click(screen.getByRole("button", { name: "Undo rename" }));
		expect(
			screen.getByRole("textbox", { name: "Name for sample_one.fastq.gz" }),
		).toHaveValue("sample_one");
		expect(
			screen.getByRole("textbox", { name: "Name for sample_two.fastq.gz" }),
		).toHaveValue("sample_two");
	});

	it.each([
		["(sample)_(\\d+)", "$2-$1", "12-sample_34"],
		["\\d+", "batch", "sample_batch_batch"],
		["^sample_", "", "12_34"],
		["$", "_end", "sample_12_34_end"],
	])(
		"should replace regex %s with %s",
		async (pattern, replacement, expected) => {
			await renderDialog([createFakeFile({ name: "sample_12_34.fastq.gz" })]);

			await userEvent.click(
				screen.getByRole("button", { name: "Use regular expression" }),
			);
			await userEvent.type(
				screen.getByRole("textbox", { name: "Match text" }),
				pattern,
			);
			if (replacement) {
				await userEvent.type(
					screen.getByRole("textbox", { name: "Replacement" }),
					replacement,
				);
			}
			await userEvent.click(
				screen.getByRole("button", { name: /^Replace in \d+ names?$/ }),
			);

			expect(
				screen.getByRole("textbox", { name: "Name for sample_12_34.fastq.gz" }),
			).toHaveValue(expected);
		},
	);

	it("should block invalid regex and recover when corrected or disabled", async () => {
		await renderDialog([createFakeFile({ name: "sample_one.fastq.gz" })]);
		const toggle = screen.getByRole("button", {
			name: "Use regular expression",
		});
		const match = screen.getByRole("textbox", { name: "Match text" });
		const replace = screen.getByRole("button", {
			name: /^Replace in \d+ names?$/,
		});

		await userEvent.click(toggle);
		expect(replace).toBeDisabled();
		await userEvent.type(match, "(");
		expect(match).toHaveAccessibleDescription(
			"Enter a valid regular expression.",
		);
		expect(match).toHaveAttribute("aria-invalid", "true");
		expect(replace).toBeDisabled();
		expect(
			screen.getByRole("textbox", { name: "Name for sample_one.fastq.gz" }),
		).toHaveValue("sample_one");

		await userEvent.click(toggle);
		expect(
			screen.queryByText("Enter a valid regular expression."),
		).not.toBeInTheDocument();
		expect(match).toHaveAttribute("aria-invalid", "false");
		await userEvent.click(toggle);
		await userEvent.clear(match);
		await userEvent.type(match, "^sample_");
		expect(
			screen.queryByText("Enter a valid regular expression."),
		).not.toBeInTheDocument();
		expect(replace).toBeEnabled();
		await userEvent.click(replace);
		expect(
			screen.getByRole("textbox", { name: "Name for sample_one.fastq.gz" }),
		).toHaveValue("one");
	});

	it("should replace the whole name once with a standalone wildcard", async () => {
		await renderDialog([createFakeFile({ name: "sample_one.fastq.gz" })]);

		await userEvent.type(
			screen.getByRole("textbox", { name: "Match text" }),
			"*",
		);
		await userEvent.type(
			screen.getByRole("textbox", { name: "Replacement" }),
			"renamed",
		);
		await userEvent.click(
			screen.getByRole("button", { name: /^Replace in \d+ names?$/ }),
		);

		expect(
			screen.getByRole("textbox", {
				name: "Name for sample_one.fastq.gz",
			}),
		).toHaveValue("renamed");
	});

	it("should require a name after deleting it with a standalone wildcard", async () => {
		const createSample = mockCreateSample();
		await renderDialog([createFakeFile({ name: "sample_one.fastq.gz" })]);

		await userEvent.type(
			screen.getByRole("textbox", { name: "Match text" }),
			"*",
		);
		await userEvent.click(
			screen.getByRole("button", { name: /^Replace in \d+ names?$/ }),
		);

		expect(
			screen.getByRole("textbox", {
				name: "Name for sample_one.fastq.gz",
			}),
		).toHaveValue("");
		expect(await screen.findByText("Required Field")).toBeInTheDocument();

		await submitForm();

		expect(createSample).not.toHaveBeenCalled();
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
		expect(
			screen.getByText("The others were created and have left the list."),
		).toBeInTheDocument();

		// The created sample's reads are reserved, so its row and only its files
		// leave the draft selection.
		expect(onCreated).toHaveBeenCalledWith([first]);
		expect(
			screen.queryByRole("textbox", { name: "Name for sample_one.fastq.gz" }),
		).not.toBeInTheDocument();
		expect(
			screen.getByRole("textbox", { name: "Name for sample_two.fastq.gz" }),
		).toHaveValue("sample_two");
	});

	it("should not claim any samples were created when the entire batch fails", async () => {
		const file = createFakeFile({ name: "sample_one.fastq.gz" });
		sampleServerFnMocks.createSampleFn.mockRejectedValue(
			new Error("Name is already in use"),
		);

		await renderDialog([file]);
		await submitForm();

		expect(
			await screen.findByText("1 sample could not be created."),
		).toBeInTheDocument();
		expect(
			screen.queryByText("The others were created and have left the list."),
		).not.toBeInTheDocument();
	});
});
