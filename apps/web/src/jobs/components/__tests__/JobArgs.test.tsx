import { screen } from "@testing-library/react";
import { renderWithRouter } from "@tests/setup";
import { describe, expect, it } from "vitest";
import JobArgs from "../JobArgs";

const workflows = [
	{
		workflow: "build_index",
		args: { index_id: 41, ref_id: "ref1" },
		links: [
			{ name: "41", href: "/refs/ref1/indexes/41" },
			{ name: "ref1", href: "/refs/ref1" },
		],
	},
	{
		workflow: "create_sample",
		args: { sample_id: "smp1" },
		links: [{ name: "smp1", href: "/samples/smp1" }],
	},
	{
		workflow: "create_subtraction",
		args: { subtraction_id: "sub1" },
		links: [{ name: "sub1", href: "/subtractions/sub1" }],
	},
	{
		workflow: "pathoscope",
		args: { sample_id: "smp1", analysis_id: "9254" },
		links: [
			{ name: "smp1", href: "/samples/smp1" },
			{ name: "9254", href: "/samples/smp1/analyses/9254" },
		],
	},
	{
		workflow: "nuvs",
		args: { sample_id: "smp1", analysis_id: "9254" },
		links: [
			{ name: "smp1", href: "/samples/smp1" },
			{ name: "9254", href: "/samples/smp1/analyses/9254" },
		],
	},
];

describe("<JobArgs />", () => {
	it("should render basics correctly", async () => {
		await renderWithRouter(
			<JobArgs
				workflow="create_sample"
				args={{ sample_id: "test_sample_id" }}
			/>,
		);

		expect(screen.getByText("Arguments")).toBeInTheDocument();
		expect(
			screen.getByText("Run arguments that make this job unique."),
		).toBeInTheDocument();
	});

	it.each(workflows)(
		"should render $workflow jobs correctly",
		async ({ workflow, args, links }) => {
			await renderWithRouter(
				<JobArgs
					workflow={workflow}
					args={{ ...args, extra_param: "extra_param" }}
				/>,
			);

			for (const { name, href } of links) {
				expect(screen.getByRole("link", { name })).toHaveAttribute(
					"href",
					href,
				);
			}
			expect(screen.queryByText("extra_param")).not.toBeInTheDocument();
		},
	);

	it("should render unknown workflows", async () => {
		await renderWithRouter(
			<JobArgs
				workflow="unknown_workflow"
				args={{
					sample_id: "test_sample_id",
					extra_param: "extra_param_id",
					excluded_param: {},
				}}
			/>,
		);

		expect(screen.getByText("test_sample_id")).toBeInTheDocument();
		expect(screen.queryByText("extra_param")).toBeInTheDocument();
		expect(screen.queryByText("extra_param_id")).toBeInTheDocument();
	});
});
