import AnalysisItem from "@analyses/components/AnalysisItem";
import { screen } from "@testing-library/react";
import { createFakeAccount } from "@tests/fake/account";
import { createFakeAnalysisMinimal } from "@tests/fake/analyses";
import { mockGetAccount } from "@tests/server-fn/users";
import { MemoryRouter, renderWithProviders } from "@tests/setup";
import type { AnalysisMinimal, JobState } from "@virtool/contracts";
import { beforeEach, describe, expect, it } from "vitest";

describe("<AnalysisItem />", () => {
	beforeEach(() => {
		mockGetAccount(createFakeAccount({ administratorRole: "full" }));
	});

	function renderItem(overrides: Partial<AnalysisMinimal>) {
		renderWithProviders(
			<MemoryRouter>
				<AnalysisItem analysis={createFakeAnalysisMinimal(overrides)} />
			</MemoryRouter>,
		);
	}

	function withJob(state: JobState, ready: boolean): Partial<AnalysisMinimal> {
		const { job } = createFakeAnalysisMinimal();

		return { ready, job: job && { ...job, state } };
	}

	/**
	 * The remove button only ever appears once the account query resolves, so
	 * its absence means nothing until that has had a chance to happen. Waiting
	 * for the find to time out is what makes these assertions non-vacuous.
	 */
	async function expectNoRemoveButton() {
		await expect(
			screen.findByRole("button", { name: "remove" }),
		).rejects.toThrow();
	}

	it("offers removal for a finished analysis", async () => {
		renderItem(withJob("succeeded", true));

		expect(
			await screen.findByRole("button", { name: "remove" }),
		).toBeInTheDocument();
	});

	it.each<JobState>(["pending", "running"])(
		"withholds removal while the job is %s",
		async (state) => {
			renderItem(withJob(state, false));

			expect(await screen.findByRole("progressbar")).toBeInTheDocument();
			await expectNoRemoveButton();
		},
	);

	// The workflow writes its analysis result before the job is marked terminal,
	// so `ready` alone would advertise a button the server answers with a 409.
	it("withholds removal from a ready analysis whose job is still running", async () => {
		renderItem(withJob("running", true));

		await expectNoRemoveButton();
	});

	// An OOM-killed or evicted pod leaves the analysis unready forever. It has to
	// stay removable, or the user is stuck looking at it.
	it.each<JobState>(["cancelled", "failed", "succeeded"])(
		"offers removal for an unready analysis whose job is %s",
		async (state) => {
			renderItem(withJob(state, false));

			expect(
				await screen.findByRole("button", { name: "remove" }),
			).toBeInTheDocument();
			// The failure itself stays on screen alongside the remove button.
			expect(screen.getByRole("progressbar")).toBeInTheDocument();
		},
	);

	it("offers removal for an unready analysis with no job", async () => {
		renderItem({ ready: false, job: null });

		expect(
			await screen.findByRole("button", { name: "remove" }),
		).toBeInTheDocument();
	});
});
