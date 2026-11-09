import { screen } from "@testing-library/react";
import { createFakeHmmSearchResults } from "@tests/fake/hmm";
import { createFakeSample } from "@tests/fake/samples";
import { createFakeTask } from "@tests/fake/tasks";
import { mockListReadyIndexes } from "@tests/server-fn/indexes";
import { mockGetSample } from "@tests/server-fn/samples";
import { mockListSubtractionsShortlist } from "@tests/server-fn/subtractions";
import { renderWithRouter } from "@tests/setup";
import type { HmmStatus } from "@virtool/contracts";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CreateAnalysisBody from "../CreateAnalysisBody";

const ALERT_TEXT = "HMM data is not installed.";

async function renderBody(status: Omit<HmmStatus, "errors">) {
	const sample = createFakeSample({ subtractions: [] });
	mockGetSample(sample);

	await renderWithRouter(
		<CreateAnalysisBody
			hmms={createFakeHmmSearchResults({
				status: { errors: [], ...status },
			})}
			onClose={vi.fn()}
			sampleCount={1}
			sampleIds={[sample.id]}
		/>,
	);

	await screen.findByRole("button", { name: "Create" });
}

describe("<CreateAnalysisBody>", () => {
	beforeEach(() => {
		mockListReadyIndexes([]);
		mockListSubtractionsShortlist([]);
	});

	it("hides the HMM alert when a release is installed and no task is recorded", async () => {
		await renderBody({ installed: { ready: true }, task: null });

		expect(screen.queryByText(ALERT_TEXT)).not.toBeInTheDocument();
	});

	it("hides the HMM alert when a release is installed and a later install is running", async () => {
		await renderBody({
			installed: { ready: true },
			task: createFakeTask({ complete: false }),
		});

		expect(screen.queryByText(ALERT_TEXT)).not.toBeInTheDocument();
	});

	it("shows the HMM alert when nothing is installed", async () => {
		await renderBody({ installed: null, task: null });

		expect(screen.getByText(ALERT_TEXT)).toBeInTheDocument();
	});
});
