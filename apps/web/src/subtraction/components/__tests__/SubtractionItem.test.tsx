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
			user: createFakeUserNested(),
		};
	});

	it("should render", async () => {
		await renderWithRouter(<SubtractionItem {...props} />);

		expect(screen.getByText("Arabidopsis thaliana")).toBeInTheDocument();
		expect(screen.getByRole("progressbar")).toHaveAttribute("data-value", "50");
	});

	it.each(["pending", "running", "failed"] as const)(
		"should render progress bar for ",
		async (state) => {
			if (props.job) {
				props.job.state = state;
			}

			await renderWithRouter(<SubtractionItem {...props} />);
			expect(screen.getByRole("progressbar")).toBeInTheDocument();
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
		},
	);

	it.each(["pending", "running"] as const)(
		"should not label the state when the job is %s",
		async (state) => {
			if (props.job) {
				props.job.state = state;
			}

			await renderWithRouter(<SubtractionItem {...props} />);

			expect(screen.queryByText(state)).not.toBeInTheDocument();
		},
	);

	it("should not render progress bar if job is ready", async () => {
		props.ready = true;

		await renderWithRouter(<SubtractionItem {...props} />);

		expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
		expect(screen.queryByText("Complete")).not.toBeInTheDocument();
		expect(
			screen.getByText(`${props.user?.handle} created`),
		).toBeInTheDocument();
		expect(screen.getByText("1 year ago")).toBeInTheDocument();
	});

	it("should correctly render subtractions where job is absent", async () => {
		props.job = null;
		props.ready = false;

		await renderWithRouter(<SubtractionItem {...props} />);
	});
});
