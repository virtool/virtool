import type { InfiniteData } from "@tanstack/react-query";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createFakeFile } from "@tests/fake/files";
import { mockFindUploads } from "@tests/server-fn/uploads";
import { renderWithProviders } from "@tests/setup";
import type { Upload, UploadSearchResult } from "@virtool/contracts";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import ReadSelector from "../ReadSelector";

function makeData(files: Upload[]): InfiniteData<UploadSearchResult> {
	return {
		pages: [
			{
				foundCount: files.length,
				page: 1,
				pageCount: 1,
				perPage: 25,
				totalCount: files.length,
				items: files,
			},
		],
		pageParams: [1],
	};
}

function Harness({
	files,
	initialSelected = [],
}: {
	files: Upload[];
	initialSelected?: number[];
}) {
	const [selected, setSelected] = useState(initialSelected);

	return (
		<ReadSelector
			data={makeData(files)}
			isFetchingNextPage={false}
			fetchNextPage={vi.fn()}
			isPending={false}
			selected={selected}
			onSelect={setSelected}
		/>
	);
}

function escapeRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** The list button (single or pair) whose accessible name contains `name`. */
function rowButton(name: string): HTMLElement {
	return screen.getByRole("button", { name: new RegExp(escapeRegExp(name)) });
}

async function setMode(name: "Auto-pair" | "Manual"): Promise<void> {
	await userEvent.click(
		screen.getByRole("button", { name: /^(Auto-pair|Manual)$/ }),
	);
	await userEvent.click(
		await screen.findByRole("menuitem", { name: new RegExp(name) }),
	);
}

describe("<ReadSelector>", () => {
	it("defaults to Auto-pair mode", () => {
		mockFindUploads([]);
		renderWithProviders(<Harness files={[createFakeFile()]} />);

		expect(
			screen.getByRole("button", { name: /^(Auto-pair|Manual)$/ }),
		).toHaveTextContent("Auto-pair");
	});

	describe("Auto-pair mode", () => {
		it("replaces the selection with a single file on click", async () => {
			const firstFile = createFakeFile({ name: "alpha.fastq.gz" });
			const secondFile = createFakeFile({ name: "beta.fastq.gz" });
			const files = [firstFile, secondFile];

			mockFindUploads(files);

			renderWithProviders(<Harness files={files} />);

			await userEvent.click(rowButton(firstFile.name));
			expect(within(rowButton(firstFile.name)).getByText("LEFT")).toBeVisible();
			expect(screen.getByText("Unpaired")).toBeInTheDocument();

			// A second click replaces rather than accumulates.
			await userEvent.click(rowButton(secondFile.name));
			expect(rowButton(firstFile.name)).toHaveAttribute(
				"aria-pressed",
				"false",
			);
			expect(
				within(rowButton(secondFile.name)).getByText("LEFT"),
			).toBeVisible();
			expect(screen.getByText("Unpaired")).toBeInTheDocument();
		});

		it("selects a detected pair with one click, assigning LEFT and RIGHT", async () => {
			const r1 = createFakeFile({ name: "sample_R1.fastq.gz" });
			const r2 = createFakeFile({ name: "sample_R2.fastq.gz" });
			mockFindUploads([r1, r2]);

			renderWithProviders(<Harness files={[r1, r2]} />);

			// A detected pair renders as a single row.
			const pair = rowButton(r1.name);
			await userEvent.click(pair);

			expect(within(pair).getByText("LEFT")).toBeVisible();
			expect(within(pair).getByText("RIGHT")).toBeVisible();
			expect(screen.getByText("Paired")).toBeInTheDocument();
		});

		it("clears the selection when the selected row is clicked again", async () => {
			const file = createFakeFile({ name: "alpha.fastq.gz" });
			mockFindUploads([file]);

			renderWithProviders(<Harness files={[file]} />);

			await userEvent.click(rowButton(file.name));
			expect(rowButton(file.name)).toHaveAttribute("aria-pressed", "true");

			await userEvent.click(rowButton(file.name));
			expect(rowButton(file.name)).toHaveAttribute("aria-pressed", "false");
			expect(screen.queryByText("Unpaired")).not.toBeInTheDocument();
		});

		it("does not show the swap control", async () => {
			const files = [
				createFakeFile({ name: "alpha.fastq.gz" }),
				createFakeFile({ name: "beta.fastq.gz" }),
			];
			mockFindUploads(files);

			renderWithProviders(<Harness files={files} />);

			expect(
				screen.queryByRole("button", { name: /swap reads/i }),
			).not.toBeInTheDocument();
		});
	});

	describe("Manual mode", () => {
		it("toggles up to two files, ignoring a third and supporting unselect", async () => {
			const firstFile = createFakeFile({ name: "alpha.fastq.gz" });
			const secondFile = createFakeFile({ name: "beta.fastq.gz" });
			const thirdFile = createFakeFile({ name: "gamma.fastq.gz" });
			const files = [firstFile, secondFile, thirdFile];

			mockFindUploads(files);

			renderWithProviders(<Harness files={files} />);
			await setMode("Manual");

			await userEvent.click(rowButton(firstFile.name));
			await userEvent.click(rowButton(secondFile.name));
			expect(screen.getByText("Paired")).toBeInTheDocument();

			// The third click is a quiet no-op — the file stays unselected.
			await userEvent.click(rowButton(thirdFile.name));
			expect(rowButton(thirdFile.name)).toHaveAttribute(
				"aria-pressed",
				"false",
			);
			expect(screen.getByText("Paired")).toBeInTheDocument();

			// Unselecting frees a slot for the third file.
			await userEvent.click(rowButton(secondFile.name));
			expect(rowButton(secondFile.name)).toHaveAttribute(
				"aria-pressed",
				"false",
			);
			await userEvent.click(rowButton(thirdFile.name));
			expect(rowButton(thirdFile.name)).toHaveAttribute("aria-pressed", "true");
		});

		it("does not collapse detected pairs into a single row", async () => {
			const r1 = createFakeFile({ name: "sample_R1.fastq.gz" });
			const r2 = createFakeFile({ name: "sample_R2.fastq.gz" });
			mockFindUploads([r1, r2]);

			renderWithProviders(<Harness files={[r1, r2]} />);
			await setMode("Manual");

			// Each mate is its own selectable row.
			expect(rowButton(r1.name)).not.toBe(rowButton(r2.name));
		});

		it("swaps the LEFT and RIGHT reads", async () => {
			const firstFile = createFakeFile({ name: "alpha.fastq.gz" });
			const secondFile = createFakeFile({ name: "beta.fastq.gz" });
			const files = [firstFile, secondFile];

			mockFindUploads(files);

			renderWithProviders(<Harness files={files} />);
			await setMode("Manual");

			await userEvent.click(rowButton(firstFile.name));
			await userEvent.click(rowButton(secondFile.name));

			expect(within(rowButton(firstFile.name)).getByText("LEFT")).toBeVisible();
			expect(
				within(rowButton(secondFile.name)).getByText("RIGHT"),
			).toBeVisible();

			await userEvent.click(
				screen.getByRole("button", { name: /swap reads/i }),
			);

			expect(
				within(rowButton(firstFile.name)).getByText("RIGHT"),
			).toBeVisible();
			expect(
				within(rowButton(secondFile.name)).getByText("LEFT"),
			).toBeVisible();
		});

		it("warns, without blocking, when a file sits in the wrong slot by name", async () => {
			// An R2 file selected first lands in the LEFT slot — a mismatch.
			const r2 = createFakeFile({ name: "sample_R2.fastq.gz" });
			mockFindUploads([r2]);

			renderWithProviders(<Harness files={[r2]} />);
			await setMode("Manual");

			expect(screen.queryByText(/belongs in the other slot/i)).toBeNull();

			await userEvent.click(rowButton(r2.name));

			// Warned, but the selection still went through.
			expect(
				screen.getByText(/belongs in the other slot/i),
			).toBeInTheDocument();
			expect(rowButton(r2.name)).toHaveAttribute("aria-pressed", "true");
		});
	});

	describe("mode switching", () => {
		it("keeps the selection unchanged across a mode switch", async () => {
			const r1 = createFakeFile({ name: "sample_R1.fastq.gz" });
			const r2 = createFakeFile({ name: "sample_R2.fastq.gz" });
			mockFindUploads([r1, r2]);

			renderWithProviders(<Harness files={[r1, r2]} />);

			// Pick the pair in Auto-pair.
			await userEvent.click(rowButton(r1.name));
			expect(screen.getByText("Paired")).toBeInTheDocument();

			await setMode("Manual");

			// Still paired, with LEFT/RIGHT preserved on the now-flat rows.
			expect(screen.getByText("Paired")).toBeInTheDocument();
			expect(within(rowButton(r1.name)).getByText("LEFT")).toBeVisible();
			expect(within(rowButton(r2.name)).getByText("RIGHT")).toBeVisible();
		});

		it("shows a hand-picked pair as two badged rows back in Auto-pair", async () => {
			// Two files that do not auto-pair.
			const firstFile = createFakeFile({ name: "alpha.fastq.gz" });
			const secondFile = createFakeFile({ name: "beta.fastq.gz" });
			const files = [firstFile, secondFile];

			mockFindUploads(files);

			renderWithProviders(<Harness files={files} />);
			await setMode("Manual");

			await userEvent.click(rowButton(firstFile.name));
			await userEvent.click(rowButton(secondFile.name));

			await setMode("Auto-pair");

			// They render as two separate single rows, each keeping its badge, and
			// the slots stay filled.
			expect(within(rowButton(firstFile.name)).getByText("LEFT")).toBeVisible();
			expect(
				within(rowButton(secondFile.name)).getByText("RIGHT"),
			).toBeVisible();
			expect(screen.getByText("Paired")).toBeInTheDocument();

			// The first Auto-pair click applies replace and collapses to one.
			await userEvent.click(rowButton(firstFile.name));
			expect(rowButton(secondFile.name)).toHaveAttribute(
				"aria-pressed",
				"false",
			);
			expect(screen.getByText("Unpaired")).toBeInTheDocument();
		});
	});

	it("resets the selection and search term", async () => {
		const firstFile = createFakeFile({ name: "alpha.fastq.gz" });
		const secondFile = createFakeFile({ name: "beta.fastq.gz" });
		const files = [firstFile, secondFile];

		mockFindUploads(files);

		renderWithProviders(<Harness files={files} />);
		await setMode("Manual");

		await userEvent.click(rowButton(firstFile.name));
		await userEvent.click(rowButton(secondFile.name));
		expect(screen.getByText("Paired")).toBeInTheDocument();

		await userEvent.click(screen.getByRole("button", { name: /reset/i }));

		expect(screen.queryByText("Paired")).not.toBeInTheDocument();
		expect(screen.queryAllByRole("button", { pressed: true })).toHaveLength(0);
	});

	it("notifies the user when a selected file is no longer available", async () => {
		const available = [createFakeFile()];
		// The validation query no longer returns the previously selected id.
		mockFindUploads(available);

		renderWithProviders(
			<Harness files={available} initialSelected={[999999]} />,
		);

		await waitFor(() =>
			expect(
				screen.getByText(/no longer available and was removed/i),
			).toBeInTheDocument(),
		);
	});
});
