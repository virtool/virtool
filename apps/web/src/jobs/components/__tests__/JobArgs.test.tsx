import { screen } from "@testing-library/react";
import { createFakeAnalysisMinimal } from "@tests/fake/analyses";
import { createFakeSample } from "@tests/fake/samples";
import { createFakeSubtraction } from "@tests/fake/subtractions";
import { analysisServerFnMocks } from "@tests/server-fn/analyses";
import { mockGetSample } from "@tests/server-fn/samples";
import { mockGetSubtraction } from "@tests/server-fn/subtractions";
import { renderWithRouter } from "@tests/setup";
import { describe, expect, it } from "vitest";
import JobArgs from "../JobArgs";

describe("<JobArgs />", () => {
	it("should describe and link the arguments of build_index jobs", async () => {
		await renderWithRouter(
			<JobArgs
				workflow="build_index"
				args={{ index_id: "41", ref_id: "ref1", extra_param: "extra_param" }}
			/>,
		);

		expect(screen.getByText("Arguments")).toBeInTheDocument();
		expect(
			screen.getByText("Run arguments that make this job unique."),
		).toBeInTheDocument();
		expect(screen.getByText("Reference")).toBeInTheDocument();
		expect(
			screen.getByText("Reference used to build the index"),
		).toBeInTheDocument();
		expect(screen.getByText("Index")).toBeInTheDocument();
		expect(screen.getByText("Index built by this job")).toBeInTheDocument();
		expect(screen.getByRole("link", { name: "41" })).toHaveAttribute(
			"href",
			"/refs/ref1/indexes/41",
		);
		expect(screen.getByRole("link", { name: "ref1" })).toHaveAttribute(
			"href",
			"/refs/ref1",
		);
		expect(screen.queryByText("extra_param")).not.toBeInTheDocument();
	});

	it.each<"pathoscope" | "nuvs">(["pathoscope", "nuvs"])(
		"should render the analysis item for %s jobs",
		async (workflow) => {
			const analysis = createFakeAnalysisMinimal({
				id: 9254,
				sample: { id: 123, name: "Sample 123" },
				workflow,
			});
			analysisServerFnMocks.getAnalysisFn.mockResolvedValue(analysis);

			await renderWithRouter(
				<JobArgs
					workflow={workflow}
					args={{ sample_id: "123", analysis_id: "9254" }}
				/>,
			);

			expect(
				await screen.findByRole("link", {
					name: workflow === "pathoscope" ? "Pathoscope" : "Nuvs",
				}),
			).toHaveAttribute("href", "/samples/123/analyses/9254");
			expect(screen.queryByText("Arguments")).not.toBeInTheDocument();
		},
	);

	it("should render the sample for create_sample jobs", async () => {
		mockGetSample(createFakeSample({ id: 123, name: "Foo" }));

		await renderWithRouter(
			<JobArgs workflow="create_sample" args={{ sample_id: "123" }} />,
		);

		expect(await screen.findByRole("link", { name: "Foo" })).toHaveAttribute(
			"href",
			"/samples/123",
		);
		expect(screen.queryByText("Arguments")).not.toBeInTheDocument();
	});

	it("should render the subtraction for create_subtraction jobs", async () => {
		mockGetSubtraction(createFakeSubtraction({ id: 5, name: "Arabidopsis" }));

		await renderWithRouter(
			<JobArgs workflow="create_subtraction" args={{ subtraction_id: "5" }} />,
		);

		expect(
			await screen.findByRole("link", { name: "Arabidopsis" }),
		).toHaveAttribute("href", "/subtractions/5");
		expect(screen.queryByText("Arguments")).not.toBeInTheDocument();
	});

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
