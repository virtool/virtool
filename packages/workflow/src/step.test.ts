import { describe, expect, it } from "vitest";
import { WorkflowDefinitionError } from "./errors";
import { defineWorkflow, type WorkflowStep } from "./step";

type Data = { referenceId: string };
type State = { hits: number };

function makeStep(overrides: Partial<WorkflowStep<Data, State>> = {}) {
	return {
		id: "map_representatives",
		description: "Map reads to reference representatives.",
		run: async () => {},
		...overrides,
	};
}

function define(steps: WorkflowStep<Data, State>[]) {
	return defineWorkflow<Data, State>({
		name: "pathoscope",
		buildContext: async () => ({ referenceId: "ref" }),
		createState: () => ({ hits: 0 }),
		steps,
	});
}

describe("defineWorkflow", () => {
	it("returns the definition with every step's display name resolved", () => {
		const workflow = define([
			makeStep(),
			makeStep({ id: "write_report", description: "Write the report." }),
		]);

		expect(workflow.steps.map((step) => step.name)).toEqual([
			"Map Representatives",
			"Write Report",
		]);
	});

	it("keeps an explicit display name", () => {
		const workflow = define([makeStep({ name: "Map to Representatives" })]);

		expect(workflow.steps[0]?.name).toBe("Map to Representatives");
	});

	// The display name is what the UI shows, so it has to come out of the id
	// with every letter whose predecessor is not a letter uppercased.
	it("title-cases an id carrying a digit", () => {
		const workflow = define([
			makeStep({ id: "build_bowtie2_index", description: "Build the index." }),
		]);

		expect(workflow.steps[0]?.name).toBe("Build Bowtie2 Index");
	});

	it("preserves the authored step order", () => {
		const workflow = define([
			makeStep({ id: "first", description: "First." }),
			makeStep({ id: "second", description: "Second." }),
			makeStep({ id: "third", description: "Third." }),
		]);

		expect(workflow.steps.map((step) => step.id)).toEqual([
			"first",
			"second",
			"third",
		]);
	});

	it("throws when the workflow declares no steps", () => {
		expect(() => define([])).toThrow(WorkflowDefinitionError);
		expect(() => define([])).toThrow(/pathoscope/);
	});

	it.each([
		["MapRepresentatives", "camel or pascal case"],
		["map-representatives", "kebab case"],
		["2_map_isolates", "a leading digit"],
		["map isolates", "a space"],
		["", "an empty string"],
	])("throws when a step id uses %s", (id) => {
		expect(() => define([makeStep({ id })])).toThrow(WorkflowDefinitionError);
		expect(() => define([makeStep({ id })])).toThrow(
			new RegExp(`pathoscope step "${id}" has an invalid id`),
		);
	});

	it("throws when two steps share an id", () => {
		const steps = [makeStep(), makeStep()];

		expect(() => define(steps)).toThrow(WorkflowDefinitionError);
		expect(() => define(steps)).toThrow(
			/pathoscope step "map_representatives" has an id already used/,
		);
	});

	it.each([
		["", "empty"],
		["   ", "whitespace"],
	])("throws when a step description is %s", (description) => {
		expect(() => define([makeStep({ description })])).toThrow(
			WorkflowDefinitionError,
		);
		expect(() => define([makeStep({ description })])).toThrow(
			/pathoscope step "map_representatives" has an empty description/,
		);
	});
});
