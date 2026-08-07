import type { ServerJob } from "@jobs/types";
import { screen } from "@testing-library/react";
import { createFakeIndex } from "@tests/fake/indexes";
import { mockGetIndex } from "@tests/server-fn/indexes";
import { mockGetJob } from "@tests/server-fn/jobs";
import { renderRoute } from "@tests/setup";
import { describe, expect, it } from "vitest";

// `toJob` builds `args` as a string map, so the index id arrives stringified.
function createBuildIndexJob(indexId: number): ServerJob {
	return {
		args: { index_id: String(indexId) },
		id: 123,
		claimedAt: "2022-12-22T21:37:49.429000Z",
		createdAt: "2022-12-22T21:37:49.429000Z",
		finishedAt: "2022-12-22T21:38:49.429000Z",
		progress: 100,
		state: "succeeded",
		steps: null,
		user: { id: 7, handle: "bob" },
		workflow: "build_index",
	};
}

describe("<JobDetail /> build_index links", () => {
	it("derives the reference id from the index so both links resolve", async () => {
		const refId = 55;
		const indexId = 41;

		const getJob = mockGetJob(123, createBuildIndexJob(indexId));
		const getIndex = mockGetIndex(
			createFakeIndex({
				id: indexId,
				reference: { id: refId, name: "Plant Viruses" },
			}),
		);

		await renderRoute("/jobs/123");

		const referenceLink = await screen.findByRole("link", {
			name: String(refId),
		});
		expect(referenceLink).toHaveAttribute("href", `/refs/${refId}`);

		const indexLink = screen.getByRole("link", { name: String(indexId) });
		expect(indexLink).toHaveAttribute(
			"href",
			`/refs/${refId}/indexes/${indexId}`,
		);

		expect(getJob).toHaveBeenCalled();

		// The id has to reach the server function as a number — its validator
		// rejects the string the job args carry.
		expect(getIndex).toHaveBeenCalledWith({ data: { indexId } });
	});
});
