import AnalysisItem from "@analyses/components/AnalysisItem";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createFakeAccount } from "@tests/fake/account";
import { createFakeAnalysisMinimal } from "@tests/fake/analyses";
import { createFakeSample } from "@tests/fake/samples";
import { mockDeleteAnalysis } from "@tests/server-fn/analyses";
import { mockGetSample } from "@tests/server-fn/samples";
import { mockGetAccount } from "@tests/server-fn/users";
import { MemoryRouter, renderWithProviders } from "@tests/setup";
import {
	type AnalysisMinimal,
	CLIENT_ERROR_NAME,
	type JobState,
} from "@virtool/contracts";
import { beforeEach, describe, expect, it } from "vitest";

describe("<AnalysisItem />", () => {
	beforeEach(() => {
		mockGetAccount(createFakeAccount({ administratorRole: "full" }));
		mockGetSample(createFakeSample());
	});

	function renderItem(overrides: Partial<AnalysisMinimal>) {
		renderWithProviders(
			<MemoryRouter>
				<table>
					<tbody>
						<AnalysisItem analysis={createFakeAnalysisMinimal(overrides)} />
					</tbody>
				</table>
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
			screen.findByRole("button", { name: "Delete" }),
		).rejects.toThrow();
	}

	it("offers removal for a finished analysis", async () => {
		renderItem(withJob("succeeded", true));

		expect(
			await screen.findByRole("button", { name: "Delete" }),
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
				await screen.findByRole("button", { name: "Delete" }),
			).toBeInTheDocument();
			// The failure itself stays on screen alongside the remove button.
			expect(screen.getByRole("progressbar")).toBeInTheDocument();
		},
	);

	it("offers removal for an unready analysis with no job", async () => {
		renderItem({ ready: false, job: null });

		expect(
			await screen.findByRole("button", { name: "Delete" }),
		).toBeInTheDocument();
	});

	it("offers removal to a sample owner with no administrator role", async () => {
		const sample = createFakeSample({ allWrite: false, groupWrite: false });
		mockGetSample(sample);
		mockGetAccount(
			createFakeAccount({ administratorRole: null, id: sample.user.id }),
		);

		renderItem(withJob("succeeded", true));

		expect(
			await screen.findByRole("button", { name: "Delete" }),
		).toBeInTheDocument();
	});

	it.each([null, "users"] as const)(
		"withholds removal from a user who cannot write to the sample with role %s",
		async (administratorRole) => {
			const sample = createFakeSample({ allWrite: false, groupWrite: false });
			mockGetSample(sample);
			mockGetAccount(
				createFakeAccount({ administratorRole, id: sample.user.id + 1 }),
			);

			renderItem(withJob("succeeded", true));

			await expectNoRemoveButton();
		},
	);

	describe("deletion", () => {
		async function openDialog(overrides: Partial<AnalysisMinimal> = {}) {
			renderItem({ id: 42, workflow: "pathoscope", ...overrides });

			await userEvent.click(
				await screen.findByRole("button", { name: "Delete" }),
			);

			return screen.findByRole("alertdialog");
		}

		it("opens a dialog without deleting", async () => {
			const deleteAnalysis = mockDeleteAnalysis();

			const dialog = await openDialog({
				sample: { id: 7, name: "Grapevine 12" },
			});

			expect(
				within(dialog).getByRole("heading", { name: "Delete Analysis" }),
			).toBeInTheDocument();
			expect(dialog).toHaveTextContent(
				"Are you sure you want to delete the Pathoscope analysis of Grapevine 12? You can't undo this action.",
			);
			expect(deleteAnalysis).not.toHaveBeenCalled();
		});

		it("leaves out the sample when it has no name", async () => {
			const dialog = await openDialog({ sample: { id: 7, name: "" } });

			expect(dialog).toHaveTextContent(
				"Are you sure you want to delete the Pathoscope analysis? You can't undo this action.",
			);
		});

		it("deletes the analysis and closes when confirmed", async () => {
			const deleteAnalysis = mockDeleteAnalysis();

			const dialog = await openDialog();
			await userEvent.click(
				within(dialog).getByRole("button", { name: "Confirm" }),
			);

			await waitFor(() =>
				expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument(),
			);
			expect(deleteAnalysis).toHaveBeenCalledOnce();
			expect(deleteAnalysis).toHaveBeenCalledWith({
				data: { analysisId: 42 },
			});
		});

		it("does not delete when cancelled", async () => {
			const deleteAnalysis = mockDeleteAnalysis();

			const dialog = await openDialog();
			await userEvent.click(
				within(dialog).getByRole("button", { name: "Cancel" }),
			);

			await waitFor(() =>
				expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument(),
			);
			expect(deleteAnalysis).not.toHaveBeenCalled();
		});

		it("does not delete when closed with the escape key", async () => {
			const deleteAnalysis = mockDeleteAnalysis();

			await openDialog();
			await userEvent.keyboard("{Escape}");

			await waitFor(() =>
				expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument(),
			);
			expect(deleteAnalysis).not.toHaveBeenCalled();
		});

		it("shows a refusal from the server and stays open", async () => {
			const refusal = new Error("Analysis is still running");
			refusal.name = CLIENT_ERROR_NAME;
			mockDeleteAnalysis().mockRejectedValue(refusal);

			const dialog = await openDialog();
			await userEvent.click(
				within(dialog).getByRole("button", { name: "Confirm" }),
			);

			expect(await within(dialog).findByRole("alert")).toHaveTextContent(
				"Analysis is still running",
			);
			expect(screen.getByRole("alertdialog")).toBeInTheDocument();
		});
	});

	it("labels the version of an unready analysis as pending", async () => {
		renderItem({ ready: false, workflowVersion: null });

		expect(await screen.findByText("Pending")).toBeInTheDocument();
		expect(screen.queryByText("not recorded")).not.toBeInTheDocument();
	});

	it("labels a ready analysis with no version as not recorded", async () => {
		renderItem({ ready: true, workflowVersion: null });

		expect(await screen.findByText("not recorded")).toBeInTheDocument();
	});
});
