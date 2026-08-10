import { getSubtractionFastaName } from "@subtraction/utils";
import { screen } from "@testing-library/react";
import { createFakeAccount } from "@tests/fake/account";
import { createFakeJobNested } from "@tests/fake/jobs";
import { createFakePermissions } from "@tests/fake/permissions";
import { createFakeSubtraction } from "@tests/fake/subtractions";
import { mockGetSubtraction } from "@tests/server-fn/subtractions";
import { renderRoute } from "@tests/setup";
import type { SubtractionMinimal } from "@virtool/contracts";
import { beforeEach, describe, expect, it } from "vitest";

function formatSubtractionPath(subtraction: SubtractionMinimal) {
	return `/subtractions/${subtraction.id}`;
}

describe("<SubtractionDetail />", () => {
	let subtraction: ReturnType<typeof createFakeSubtraction>;
	let path: string;

	beforeEach(() => {
		// Pin count and linkedSamples so neither the sequence-count nor the
		// linked-samples cell can render the same number as the other.
		subtraction = createFakeSubtraction({
			count: 100,
			linkedSamples: [
				{ id: 1, name: "sample-a" },
				{ id: 2, name: "sample-b" },
				{ id: 3, name: "sample-c" },
			],
		});
		path = formatSubtractionPath(subtraction);
	});

	it("should render", async () => {
		const getSubtraction = mockGetSubtraction(subtraction);
		await renderRoute(path);

		expect(await screen.findByText(subtraction.name)).toBeInTheDocument();
		expect(await screen.findByText(subtraction.nickname)).toBeInTheDocument();
		expect(
			await screen.findByText(subtraction.linkedSamples.length),
		).toBeInTheDocument();

		const fastaName = getSubtractionFastaName(subtraction.name);
		const download = await screen.findByRole("link", { name: fastaName });
		expect(download).toHaveAttribute("href", subtraction.files[0]?.downloadUrl);
		expect(download).toHaveAttribute("download", fastaName);

		expect(getSubtraction).toHaveBeenCalled();
	});

	it("should render loading when [detail=null]", async () => {
		await renderRoute(path);

		expect(screen.getByLabelText("loading")).toBeInTheDocument();
		expect(screen.queryByText(subtraction.name)).not.toBeInTheDocument();
	});

	it("should render pending message when subtraction is not ready", async () => {
		const unreadySubtraction = createFakeSubtraction({
			ready: false,
			job: createFakeJobNested({
				state: "running",
				workflow: "create_subtraction",
			}),
		});
		const getSubtraction = mockGetSubtraction(unreadySubtraction);
		await renderRoute(formatSubtractionPath(unreadySubtraction));

		expect(
			await screen.findByText("Subtraction is still being imported"),
		).toBeInTheDocument();

		expect(getSubtraction).toHaveBeenCalled();
	});

	it.each([
		["failed", "The create job failed."],
		["cancelled", "The create job was cancelled."],
	] as const)(
		"should offer deletion when the create job %s",
		async (state, sentence) => {
			const permissions = createFakePermissions({ modify_subtraction: true });
			const account = createFakeAccount({ permissions });
			const job = createFakeJobNested({
				state,
				workflow: "create_subtraction",
			});
			const failedSubtraction = createFakeSubtraction({ ready: false, job });
			const getSubtraction = mockGetSubtraction(failedSubtraction);

			await renderRoute(formatSubtractionPath(failedSubtraction), { account });

			expect(
				await screen.findByText(failedSubtraction.name),
			).toBeInTheDocument();
			expect(
				screen.getByText(
					`${sentence} This subtraction can't be used and should be deleted.`,
				),
			).toBeInTheDocument();
			expect(screen.getByRole("link", { name: "View job" })).toHaveAttribute(
				"href",
				`/jobs/${job.id}`,
			);
			expect(
				screen.getByRole("button", { name: "delete" }),
			).toBeInTheDocument();
			expect(screen.queryByRole("button", { name: "modify" })).toBeNull();
			expect(
				screen.queryByText("Subtraction is still being imported"),
			).toBeNull();

			expect(getSubtraction).toHaveBeenCalled();
		},
	);

	it("should not link to the job of a failed subtraction whose creator was removed", async () => {
		const permissions = createFakePermissions({ modify_subtraction: true });
		const account = createFakeAccount({ permissions });
		const failedSubtraction = createFakeSubtraction({
			ready: false,
			job: {
				...createFakeJobNested({
					state: "failed",
					workflow: "create_subtraction",
				}),
				user: null,
			},
		});
		mockGetSubtraction(failedSubtraction);

		await renderRoute(formatSubtractionPath(failedSubtraction), { account });

		expect(await screen.findByText(failedSubtraction.name)).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "delete" })).toBeInTheDocument();
		expect(screen.queryByRole("link", { name: "View job" })).toBeNull();
	});

	it("should not offer deletion of a failed subtraction without permission", async () => {
		const permissions = createFakePermissions({ modify_subtraction: false });
		const account = createFakeAccount({ permissions });
		const failedSubtraction = createFakeSubtraction({
			ready: false,
			job: createFakeJobNested({
				state: "failed",
				workflow: "create_subtraction",
			}),
		});
		mockGetSubtraction(failedSubtraction);

		await renderRoute(formatSubtractionPath(failedSubtraction), { account });

		expect(await screen.findByText(failedSubtraction.name)).toBeInTheDocument();
		expect(screen.queryByRole("button", { name: "delete" })).toBeNull();
	});

	it("should not render icons when [canModify=true]", async () => {
		const permissions = createFakePermissions({ modify_subtraction: true });
		const account = createFakeAccount({ permissions });
		const getSubtraction = mockGetSubtraction(subtraction);
		await renderRoute(path, { account });

		expect(await screen.findByText(subtraction.name)).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "modify" })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "delete" })).toBeInTheDocument();

		expect(getSubtraction).toHaveBeenCalled();
	});

	it("should not render icons when [canModify=false]", async () => {
		const permissions = createFakePermissions({
			modify_subtraction: false,
		});
		const account = createFakeAccount({ permissions });
		const getSubtraction = mockGetSubtraction(subtraction);
		await renderRoute(path, { account });

		expect(await screen.findByText(subtraction.name)).toBeInTheDocument();
		expect(screen.queryByRole("button", { name: "modify" })).toBeNull();
		expect(screen.queryByRole("button", { name: "delete" })).toBeNull();

		expect(getSubtraction).toHaveBeenCalled();
	});
});
