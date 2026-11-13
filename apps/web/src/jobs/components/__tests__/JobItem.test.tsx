import { screen } from "@testing-library/react";
import { createFakeUserNested } from "@tests/fake/user";
import { renderWithRouter } from "@tests/setup";
import type { JobState } from "@virtool/contracts";
import { beforeEach, describe, expect, it } from "vitest";
import JobItem, { type JobItemProps } from "../JobItem";

describe("<JobItem />", () => {
	let props: JobItemProps;

	beforeEach(() => {
		props = {
			id: 42,
			workflow: "build_index",
			createdAt: new Date("2022-12-22T21:37:49.429000Z"),
			progress: 0,
			state: "pending",
			user: createFakeUserNested(),
		};
	});

	it.each<[JobState, number]>([
		["running", 40],
		["succeeded", 100],
	])("should render state=%s with progress=%s", async (state, progress) => {
		props.state = state;
		props.progress = progress;

		await renderWithRouter(<JobItem {...props} />);

		expect(screen.getByText("Build Index")).toBeInTheDocument();
		expect(
			screen.getByText(`${props.user.username} created`),
		).toBeInTheDocument();
		expect(screen.getByText(state)).toBeInTheDocument();

		const progressbar = screen.queryByRole("progressbar");

		if (state === "succeeded") {
			expect(progressbar).toBeNull();
		} else {
			expect(progressbar).toHaveAttribute("data-value", `${progress}`);
		}
	});
});
