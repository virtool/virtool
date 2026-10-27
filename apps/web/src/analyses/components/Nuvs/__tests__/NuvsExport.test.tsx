import NuvsExport from "@analyses/components/Nuvs/NuvsExport";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createFakeFormattedNuvsAnalysis } from "@tests/fake/analyses";
import { renderWithProviders } from "@tests/setup";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("<NuvsExport />", () => {
	let props: React.ComponentProps<typeof NuvsExport>;
	let clickSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		const analysis = createFakeFormattedNuvsAnalysis();

		props = {
			analysisId: 42,
			results: analysis.results,
			sampleName: "Test Sample",
		};

		clickSpy = vi
			.spyOn(HTMLAnchorElement.prototype, "click")
			.mockImplementation(() => undefined);
	});

	afterEach(() => {
		clickSpy.mockRestore();
	});

	async function openDialog() {
		renderWithProviders(<NuvsExport {...props} />);
		await userEvent.click(screen.getByRole("button", { name: "Export" }));
	}

	it("shows the contigs tab and preview by default", async () => {
		await openDialog();

		const tabs = screen.getByRole("tablist", { name: "Scope" });
		expect(tabs).toBeInTheDocument();
		expect(screen.getByRole("tab", { name: "Contigs" })).toHaveAttribute(
			"aria-selected",
			"true",
		);
		expect(screen.getByText("sequence index")).toBeInTheDocument();
	});

	it("switches the preview when the ORFs tab is selected", async () => {
		await openDialog();

		await userEvent.click(screen.getByRole("tab", { name: "ORFs" }));

		expect(screen.getByRole("tab", { name: "ORFs" })).toHaveAttribute(
			"aria-selected",
			"true",
		);
		expect(screen.getByText("sequence index + orf index")).toBeInTheDocument();
	});

	it("downloads contig data with a contigs filename by default", async () => {
		await openDialog();

		await userEvent.click(screen.getByRole("button", { name: "Download" }));

		await waitFor(() => expect(clickSpy).toHaveBeenCalledTimes(1));
		const anchor = clickSpy.mock.instances[0] as HTMLAnchorElement;
		expect(anchor.download).toBe("nuvs.Test_Sample.42.contigs.fa");
		expect(decodeURIComponent(anchor.href)).toContain(">sequence_");
	});

	it("downloads orf data with an orfs filename when ORFs is selected", async () => {
		await openDialog();

		await userEvent.click(screen.getByRole("tab", { name: "ORFs" }));
		await userEvent.click(screen.getByRole("button", { name: "Download" }));

		await waitFor(() => expect(clickSpy).toHaveBeenCalledTimes(1));
		const anchor = clickSpy.mock.instances[0] as HTMLAnchorElement;
		expect(anchor.download).toBe("nuvs.Test_Sample.42.orfs.fa");
		expect(decodeURIComponent(anchor.href)).toContain(">orf_");
	});
});
