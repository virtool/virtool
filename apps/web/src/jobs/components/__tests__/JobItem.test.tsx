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

	describe("<JobItem />", () => {
		it("should render properly", async () => {
			await renderWithRouter(<JobItem {...props} />);

			expect(screen.getByText("Build Index")).toBeInTheDocument();
			expect(
				screen.getByText(`${props.user.handle} created`),
			).toBeInTheDocument();
		});
	});

	describe("<JobStatus />", () => {
		it.each<[JobState, number]>([
			["pending", 0],
			["running", 0],
			["running", 40],
			["cancelled", 45],
			["failed", 25],
		])("should render state=%s with progress=%s", async (state, progress) => {
			props.state = state;
			props.progress = progress;

			await renderWithRouter(<JobItem {...props} />);

			expect(screen.getByText(state)).toBeInTheDocument();
			expect(screen.getByRole("progressbar")).toHaveAttribute(
				"data-value",
				`${progress}`,
			);
		});

		it("should render properly when job is complete", async () => {
			props.state = "succeeded";
			props.progress = 100;

			await renderWithRouter(<JobItem {...props} />);

			expect(screen.getByText("succeeded")).toBeInTheDocument();
			expect(screen.queryByRole("progressbar")).toBeNull();
		});
	});
});
