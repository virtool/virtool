import { screen } from "@testing-library/react";
import { createFakeUserNested } from "@tests/fake/user";
import { renderWithRouter } from "@tests/setup";
import type { SubtractionMinimal } from "@virtool/contracts";
import { beforeEach, describe, expect, it } from "vitest";
import { SubtractionItem } from "../SubtractionItem";

describe("<SubtractionItem />", () => {
	let props: SubtractionMinimal;

	beforeEach(() => {
		const createdAt = new Date();

		createdAt.setFullYear(new Date().getFullYear() - 1);

		props = {
			id: 1,
			count: 12,
			createdAt,
			file: {
				id: 23,
				name: "subtraction.fa.gz",
			},
			job: {
				id: 42,
				createdAt,
				progress: 50,
				state: "running",
				workflow: "create_subtraction",
				user: createFakeUserNested(),
			},
			name: "Arabidopsis thaliana",
			nickname: "Thale cress",
			ready: false,
			sampleCount: 0,
			user: createFakeUserNested(),
		};
	});

	it.each(["pending", "running"] as const)(
		"should show progress without a state label when the job is %s",
		async (state) => {
			if (props.job) {
				props.job.state = state;
			}

			await renderWithRouter(<SubtractionItem {...props} />);

			expect(screen.getByText("Arabidopsis thaliana")).toBeInTheDocument();
			expect(screen.getByRole("progressbar")).toHaveAttribute(
				"data-value",
				"50",
			);
			expect(screen.queryByText(state)).not.toBeInTheDocument();
		},
	);

	it.each(["cancelled", "failed"] as const)(
		"should label the state when the job %s",
		async (state) => {
			if (props.job) {
				props.job.state = state;
			}

			await renderWithRouter(<SubtractionItem {...props} />);

			expect(screen.getByText(state)).toBeInTheDocument();
			expect(screen.getByRole("progressbar")).toBeInTheDocument();
		},
	);

	it.each([
		["ready", { ready: true }],
		["has no job", { job: null, ready: false }],
	] as const)(
		"should show only the attribution when the subtraction %s",
		async (_, overrides) => {
			await renderWithRouter(<SubtractionItem {...props} {...overrides} />);

			expect(screen.getByText("Arabidopsis thaliana")).toBeInTheDocument();
			expect(
				screen.getByText(`${props.user?.handle} created`),
			).toBeInTheDocument();
			expect(screen.getByText("1 year ago")).toBeInTheDocument();
			expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
		},
	);
});
