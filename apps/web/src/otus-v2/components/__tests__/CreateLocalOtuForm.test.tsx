import CreateLocalOtuForm from "@otus-v2/components/CreateLocalOtuForm";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { otuV2ServerFnMocks } from "@tests/server-fn/otusV2";
import { renderWithRouter } from "@tests/setup";
import { describe, expect, it } from "vitest";

async function renderForm() {
	otuV2ServerFnMocks.createLocalOtuFn.mockReturnValueOnce(
		new Promise(() => {}),
	);
	await renderWithRouter(
		<CreateLocalOtuForm
			referenceId="reference"
			defaultSegmentLengthTolerance={0.05}
		/>,
	);
}

async function fillSegment(index: number, key: string, sequence: string) {
	await userEvent.type(
		screen.getByLabelText(`Segment ${index} name prefix`),
		"RNA",
	);
	await userEvent.type(screen.getByLabelText(`Segment ${index} name key`), key);
	await userEvent.clear(
		screen.getByLabelText(`Segment ${index} expected length`),
	);
	await userEvent.type(
		screen.getByLabelText(`Segment ${index} expected length`),
		String(sequence.length),
	);
	await userEvent.type(
		screen.getByLabelText(`Segment ${index} sequence definition`),
		`RNA ${key}`,
	);
	await userEvent.type(
		screen.getByLabelText(`Segment ${index} sequence`),
		sequence,
	);
}

describe("<CreateLocalOtuForm />", () => {
	it("creates a complete single segment OTU", async () => {
		await renderForm();
		await userEvent.type(
			screen.getByLabelText("Name", { exact: true }),
			"Novel virus",
		);
		await userEvent.clear(screen.getByLabelText("Segment 1 expected length"));
		await userEvent.type(
			screen.getByLabelText("Segment 1 expected length"),
			"6",
		);
		await userEvent.type(
			screen.getByLabelText("Segment 1 sequence definition"),
			"Complete genome",
		);
		await userEvent.type(screen.getByLabelText("Segment 1 sequence"), "ATCGAT");
		await userEvent.click(screen.getByRole("button", { name: "Create" }));
		await waitFor(() =>
			expect(otuV2ServerFnMocks.createLocalOtuFn).toHaveBeenCalledTimes(1),
		);
		const command =
			otuV2ServerFnMocks.createLocalOtuFn.mock.calls[0]?.[0].data.command;
		expect(command).toMatchObject({ type: "CreateOTU", expectedVersion: 0 });
		expect(command.payload.plan.segments[0]).toMatchObject({
			name: null,
			length: 6,
			lengthTolerance: 0.05,
			rule: "required",
		});
		expect(command.payload.isolate.sequences[0].segmentId).toBe(
			command.payload.plan.segments[0].id,
		);
	});

	it("creates a multipartite OTU with one sequence per named segment", async () => {
		await renderForm();
		await userEvent.type(
			screen.getByLabelText("Name", { exact: true }),
			"Segmented virus",
		);
		await fillSegment(1, "1", "ATCG");
		await userEvent.click(screen.getByRole("button", { name: "Add segment" }));
		await fillSegment(2, "2", "AACCGG");
		await userEvent.selectOptions(
			screen.getByLabelText("Segment 2 rule"),
			"recommended",
		);
		await userEvent.clear(screen.getByLabelText("Segment 2 length tolerance"));
		await userEvent.type(
			screen.getByLabelText("Segment 2 length tolerance"),
			"0.1",
		);
		await userEvent.click(screen.getByRole("button", { name: "Create" }));
		await waitFor(() =>
			expect(otuV2ServerFnMocks.createLocalOtuFn).toHaveBeenCalledTimes(1),
		);
		const command =
			otuV2ServerFnMocks.createLocalOtuFn.mock.calls[0]?.[0].data.command;
		expect(command.payload.plan.segments).toMatchObject([
			{ name: { prefix: "RNA", key: "1" }, length: 4, rule: "required" },
			{
				name: { prefix: "RNA", key: "2" },
				length: 6,
				lengthTolerance: 0.1,
				rule: "recommended",
			},
		]);
		expect(
			command.payload.isolate.sequences.map(
				(sequence: { segmentId: string }) => sequence.segmentId,
			),
		).toEqual(
			command.payload.plan.segments.map(
				(segment: { id: string }) => segment.id,
			),
		);
	});

	it("shows shared plan errors for duplicate names and lengths outside tolerance", async () => {
		await renderForm();
		await userEvent.type(
			screen.getByLabelText("Name", { exact: true }),
			"Segmented virus",
		);
		await fillSegment(1, "1", "ATCG");
		await userEvent.click(screen.getByRole("button", { name: "Add segment" }));
		await fillSegment(2, "1", "AACCGG");
		await userEvent.click(screen.getByRole("button", { name: "Create" }));
		expect(
			await screen.findByText("Segment names must be unique."),
		).toBeInTheDocument();
		expect(otuV2ServerFnMocks.createLocalOtuFn).not.toHaveBeenCalled();
		await userEvent.clear(screen.getByLabelText("Segment 2 name key"));
		await userEvent.type(screen.getByLabelText("Segment 2 name key"), "2");
		await userEvent.clear(screen.getByLabelText("Segment 2 expected length"));
		await userEvent.type(
			screen.getByLabelText("Segment 2 expected length"),
			"12",
		);
		await userEvent.click(screen.getByRole("button", { name: "Create" }));
		expect(
			await screen.findByText(
				"Sequence length is outside the segment tolerance.",
			),
		).toBeInTheDocument();
		expect(otuV2ServerFnMocks.createLocalOtuFn).not.toHaveBeenCalled();
	});
});
