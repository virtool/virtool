import type { InfiniteData } from "@tanstack/react-query";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createFakeFile } from "@tests/fake/files";
import { mockFindUploads } from "@tests/server-fn/uploads";
import { renderWithProviders } from "@tests/setup";
import type { Upload, UploadSearchResult } from "@virtool/contracts";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { SubtractionFileSelector } from "../SubtractionFileSelector";

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

function Harness({ files }: { files: Upload[] }) {
	const [selected, setSelected] = useState<number[]>([]);

	return (
		<>
			<span id="files-label">Files</span>
			<SubtractionFileSelector
				aria-labelledby="files-label"
				files={makeData(files)}
				foundCount={files.length}
				selected={selected}
				onClick={setSelected}
				error=""
				fetchNextPage={vi.fn()}
				isPending={false}
				isFetchingNextPage={false}
			/>
		</>
	);
}

describe("<SubtractionFileSelector>", () => {
	it("exposes an ARIA listbox with an option per file", () => {
		const files = [
			createFakeFile({ name: "alpha.fa.gz" }),
			createFakeFile({ name: "beta.fa.gz" }),
		];
		mockFindUploads(files);

		renderWithProviders(<Harness files={files} />);

		const listbox = screen.getByRole("listbox", { name: "Files" });
		expect(listbox).toHaveAttribute("tabindex", "0");
		expect(listbox).not.toHaveAttribute("aria-activedescendant");
		expect(screen.getAllByRole("option")).toHaveLength(2);
	});

	it("moves the active descendant with the arrow, Home, and End keys", async () => {
		const files = [
			createFakeFile({ name: "alpha.fa.gz" }),
			createFakeFile({ name: "beta.fa.gz" }),
			createFakeFile({ name: "gamma.fa.gz" }),
		];
		mockFindUploads(files);

		renderWithProviders(<Harness files={files} />);

		const listbox = screen.getByRole("listbox", { name: "Files" });
		const alpha = screen.getByRole("option", { name: /alpha\.fa\.gz/ });
		const beta = screen.getByRole("option", { name: /beta\.fa\.gz/ });
		const gamma = screen.getByRole("option", { name: /gamma\.fa\.gz/ });
		listbox.focus();

		await userEvent.keyboard("{ArrowDown}");
		expect(listbox).toHaveAttribute("aria-activedescendant", alpha.id);

		await userEvent.keyboard("{ArrowDown}");
		expect(listbox).toHaveAttribute("aria-activedescendant", beta.id);

		await userEvent.keyboard("{End}");
		expect(listbox).toHaveAttribute("aria-activedescendant", gamma.id);

		await userEvent.keyboard("{ArrowUp}");
		expect(listbox).toHaveAttribute("aria-activedescendant", beta.id);

		await userEvent.keyboard("{Home}");
		expect(listbox).toHaveAttribute("aria-activedescendant", alpha.id);
	});

	it("selects the active option with Enter", async () => {
		const files = [
			createFakeFile({ name: "alpha.fa.gz" }),
			createFakeFile({ name: "beta.fa.gz" }),
		];
		mockFindUploads(files);

		renderWithProviders(<Harness files={files} />);

		const listbox = screen.getByRole("listbox", { name: "Files" });
		listbox.focus();

		await userEvent.keyboard("{ArrowDown}{ArrowDown}{Enter}");

		expect(
			screen.getByRole("option", { name: /beta\.fa\.gz/ }),
		).toHaveAttribute("aria-selected", "true");
		expect(
			screen.getByRole("option", { name: /alpha\.fa\.gz/ }),
		).toHaveAttribute("aria-selected", "false");
	});

	it("selects an option on click", async () => {
		const files = [createFakeFile({ name: "alpha.fa.gz" })];
		mockFindUploads(files);

		renderWithProviders(<Harness files={files} />);

		await userEvent.click(
			screen.getByRole("option", { name: /alpha\.fa\.gz/ }),
		);

		expect(
			screen.getByRole("option", { name: /alpha\.fa\.gz/ }),
		).toHaveAttribute("aria-selected", "true");
	});
});
