import { screen } from "@testing-library/react";
import { createFakeAccount } from "@tests/fake/account";
import { createFakeSample } from "@tests/fake/samples";
import { mockGetSample } from "@tests/server-fn/samples";
import { mockGetAccount } from "@tests/server-fn/users";
import { renderWithRouter } from "@tests/setup";
import type { Sample } from "@virtool/contracts";
import { beforeEach, describe, expect, it } from "vitest";
import SamplePeek from "../SamplePeek";

describe("<SamplePeek />", () => {
	beforeEach(() => {
		mockGetAccount(createFakeAccount({ administratorRole: "full" }));
	});

	async function renderPeek(overrides?: Partial<Sample>) {
		const sample = createFakeSample({
			id: 123,
			name: "Foo",
			...overrides,
		});

		mockGetSample(sample);

		await renderWithRouter(<SamplePeek sampleId={sample.id} />);

		return sample;
	}

	it("links to the sample", async () => {
		await renderPeek();

		expect(await screen.findByRole("link", { name: "Foo" })).toHaveAttribute(
			"href",
			"/samples/123",
		);
	});

	// The job's own state and steps are on the same page, so the sample has no
	// business repeating them.
	it("shows no job state", async () => {
		await renderPeek({ ready: false });

		await screen.findByRole("link", { name: "Foo" });
		expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
	});
});
