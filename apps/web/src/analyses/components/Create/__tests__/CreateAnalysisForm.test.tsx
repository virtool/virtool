import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createFakeAnalysisMinimal } from "@tests/fake/analyses";
import { createFakeIndexMinimal } from "@tests/fake/indexes";
import { createFakeSample } from "@tests/fake/samples";
import { mockCreateAnalysis } from "@tests/server-fn/analyses";
import { mockListReadyIndexes } from "@tests/server-fn/indexes";
import { mockGetSample } from "@tests/server-fn/samples";
import { mockListSubtractionsShortlist } from "@tests/server-fn/subtractions";
import { renderWithRouter } from "@tests/setup";
import { describe, expect, it, vi } from "vitest";
import CreateAnalysisForm from "../CreateAnalysisForm";
import { getCompatibleWorkflows } from "../workflows";

async function renderForm(indexId?: number) {
	const onClose = vi.fn();
	const sample = createFakeSample({ subtractions: [] });
	const index = createFakeIndexMinimal({
		...(indexId === undefined ? {} : { id: indexId }),
		ready: true,
		reference: { id: 1, name: "Plant Viruses" },
	});

	mockListReadyIndexes([index]);
	mockListSubtractionsShortlist([]);
	mockGetSample(sample);

	await renderWithRouter(
		<CreateAnalysisForm
			compatibleWorkflows={getCompatibleWorkflows(false)}
			onClose={onClose}
			sampleCount={1}
			sampleIds={[sample.id]}
		/>,
	);

	return { onClose, sample };
}

async function selectReference() {
	const comboboxes = await screen.findAllByRole("combobox");
	const referenceTrigger = comboboxes.find(
		(element) => element.tagName === "BUTTON",
	);
	await userEvent.click(referenceTrigger as HTMLElement);
	await userEvent.click(
		await screen.findByRole("option", { name: /Plant Viruses/ }),
	);
}

describe("<CreateAnalysisForm>", () => {
	it("closes the dialog after creating when 'Create more' is off", async () => {
		const { onClose, sample } = await renderForm();

		const createAnalysis = mockCreateAnalysis(
			createFakeAnalysisMinimal({
				sample: { id: sample.id, name: sample.name },
			}),
		);

		await selectReference();
		await userEvent.click(screen.getByRole("button", { name: "Create" }));

		await waitFor(() => expect(onClose).toHaveBeenCalled());
		expect(createAnalysis).toHaveBeenCalled();
	});

	it("registers the selection when the server sends an integer index id", async () => {
		// The API returns the index id as an integer, but a Radix Select only
		// matches string values, so an unconverted numeric id silently fails to
		// register the pick and the form submits nothing.
		const { onClose, sample } = await renderForm(42);

		const createAnalysis = mockCreateAnalysis(
			createFakeAnalysisMinimal({
				sample: { id: sample.id, name: sample.name },
			}),
		);

		await selectReference();

		const trigger = screen
			.getAllByRole("combobox")
			.find((element) => element.tagName === "BUTTON");
		expect(trigger).toHaveTextContent("Plant Viruses");

		await userEvent.click(screen.getByRole("button", { name: "Create" }));

		await waitFor(() => expect(onClose).toHaveBeenCalled());
		expect(createAnalysis).toHaveBeenCalled();
	});

	it("keeps the dialog open and shows a toast when 'Create more' is on", async () => {
		const { onClose, sample } = await renderForm();

		const createAnalysis = mockCreateAnalysis(
			createFakeAnalysisMinimal({
				sample: { id: sample.id, name: sample.name },
			}),
		);

		await selectReference();
		await userEvent.click(screen.getByRole("switch", { name: "Create more" }));
		await userEvent.click(screen.getByRole("button", { name: "Create" }));

		expect(await screen.findByText("Analysis created")).toBeInTheDocument();
		expect(onClose).not.toHaveBeenCalled();
		expect(screen.getByText("Select a reference")).toBeInTheDocument();
		expect(createAnalysis).toHaveBeenCalled();
	});
});
