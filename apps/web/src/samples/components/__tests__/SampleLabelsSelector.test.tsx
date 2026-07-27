import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createFakeSampleMinimal } from "@tests/fake/samples";
import { sampleServerFnMocks } from "@tests/server-fn/samples";
import { renderWithRouter } from "@tests/setup";
import type { ComponentProps } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SampleLabelsSelector from "../SampleLabelsSelector";

/** The labels sent to `updateSample` for the given sample, if it was called. */
function labelsSentFor(sampleId: number): number[] | undefined {
	const call = sampleServerFnMocks.updateSampleFn.mock.calls.find(
		([arg]) => arg?.data?.sampleId === sampleId,
	);
	return call?.[0]?.data?.labels;
}

describe("<SampleLabelsSelector>", () => {
	let props: ComponentProps<typeof SampleLabelsSelector>;

	beforeEach(() => {
		props = {
			onLabelsUpdated: vi.fn(),
			selectedSamples: [],
			labels: [
				{ color: "#C4B5FD", count: 0, description: "", id: 1, name: "test" },
				{ color: "#FCA5A5", count: 0, description: "", id: 2, name: "label" },
				{ color: "#1D4ED8", count: 0, description: "", id: 3, name: "bar" },
			],
		};
	});

	it("should offer a path to create labels when none exist", async () => {
		props.labels = [];
		await renderWithRouter(<SampleLabelsSelector {...props} />);

		await userEvent.click(screen.getByRole("button", { name: "Edit labels" }));

		expect(await screen.findByText("No labels found.")).toBeInTheDocument();
		expect(
			screen.getByRole("menuitem", { name: "Manage labels" }),
		).toHaveAttribute("href", "/samples/labels");
	});

	it("should list every label and a link to manage them", async () => {
		await renderWithRouter(<SampleLabelsSelector {...props} />);

		await userEvent.click(screen.getByRole("button", { name: "Edit labels" }));

		for (const label of props.labels) {
			expect(
				screen.getByRole("menuitemcheckbox", { name: label.name }),
			).toBeInTheDocument();
		}

		expect(
			screen.getByRole("menuitem", { name: "Manage labels" }),
		).toHaveAttribute("href", "/samples/labels");
	});

	it("should narrow the list to labels matching the search term", async () => {
		await renderWithRouter(<SampleLabelsSelector {...props} />);

		await userEvent.click(screen.getByRole("button", { name: "Edit labels" }));
		await userEvent.type(
			screen.getByRole("textbox", { name: "Filter labels" }),
			"ba",
		);

		expect(
			screen.getByRole("menuitemcheckbox", { name: "bar" }),
		).toBeInTheDocument();
		expect(
			screen.queryByRole("menuitemcheckbox", { name: "test" }),
		).not.toBeInTheDocument();
	});

	describe("toggling a label with mixed labels across the selection", () => {
		beforeEach(() => {
			// The bulk toggle patches each sample through the updateSample server
			// function; let it resolve so the mutation settles.
			sampleServerFnMocks.updateSampleFn.mockResolvedValue({});

			// "test" (id 1) is on both samples, "label" (id 2) is on one only, so
			// the selection has labels in mixed states.
			props.selectedSamples = [
				createFakeSampleMinimal({
					name: "Foo Sample",
					id: 1,
					labels: [
						{ color: "#C4B5FD", description: "", id: 1, name: "test" },
						{ color: "#FCA5A5", description: "", id: 2, name: "label" },
					],
				}),
				createFakeSampleMinimal({
					name: "Bar Sample",
					id: 2,
					labels: [{ color: "#C4B5FD", description: "", id: 1, name: "test" }],
				}),
			];
		});

		async function openSelector() {
			await renderWithRouter(<SampleLabelsSelector {...props} />);

			await userEvent.click(
				screen.getByRole("button", { name: "Edit labels" }),
			);
		}

		async function openSelectorAndClick(labelName: string) {
			await openSelector();
			await userEvent.click(
				screen.getByRole("menuitemcheckbox", { name: labelName }),
			);
		}

		it("checks fully-applied labels and marks partial ones indeterminate", async () => {
			await openSelector();

			expect(
				screen.getByRole("menuitemcheckbox", { name: "test" }),
			).toHaveAttribute("aria-checked", "true");
			expect(
				screen.getByRole("menuitemcheckbox", { name: "label" }),
			).toHaveAttribute("aria-checked", "mixed");
			expect(
				screen.getByRole("menuitemcheckbox", { name: "bar" }),
			).toHaveAttribute("aria-checked", "false");
		});

		it("removes a fully-applied label from every sample", async () => {
			await openSelectorAndClick("test");

			await waitFor(() => {
				expect(labelsSentFor(1)).toEqual([2]);
				expect(labelsSentFor(2)).toEqual([]);
			});
		});

		it("adds a partially-applied label to every sample", async () => {
			await openSelectorAndClick("label");

			await waitFor(() => {
				expect(labelsSentFor(1)).toEqual([1, 2]);
				expect(labelsSentFor(2)).toEqual([1, 2]);
			});
		});

		it("adds an unapplied label to every sample", async () => {
			await openSelectorAndClick("bar");

			await waitFor(() => {
				expect(labelsSentFor(1)).toEqual([1, 2, 3]);
				expect(labelsSentFor(2)).toEqual([1, 3]);
			});
		});
	});
});
