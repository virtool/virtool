import { describe, expect, it } from "vitest";
import { createWorkflowContext } from "./context";
import { WorkflowError } from "./errors";
import { defineWorkflow, type WorkflowDefinition } from "./step";
import { createFakeBuildContextInput } from "./testFixtures";

type Data = { referenceId: string; otuIds: string[] };
type State = { hits: number };

function define(overrides: Partial<WorkflowDefinition<Data, State>> = {}) {
	return defineWorkflow<Data, State>({
		name: "pathoscope",
		buildContext: async () => ({ referenceId: "ref", otuIds: ["a", "b"] }),
		createState: () => ({ hits: 0 }),
		steps: [
			{ id: "map_reads", description: "Map reads.", run: async () => {} },
		],
		...overrides,
	});
}

describe("createWorkflowContext", () => {
	it("assembles the context from the builder's data and a fresh state", async () => {
		const input = createFakeBuildContextInput();

		const context = await createWorkflowContext(define(), input);

		expect(context.data).toEqual({ referenceId: "ref", otuIds: ["a", "b"] });
		expect(context.state).toEqual({ hits: 0 });
		expect(context.job).toBe(input.job);
		expect(context.workPath).toBe(input.workPath);
		expect(context.proc).toBe(input.proc);
		expect(context.mem).toBe(input.mem);
		expect(context.signal).toBe(input.signal);
	});

	it("hands the builder everything it was given", async () => {
		const input = createFakeBuildContextInput();
		const seen: unknown[] = [];

		await createWorkflowContext(
			define({
				buildContext: async (received) => {
					seen.push(received);
					return { referenceId: "ref", otuIds: [] };
				},
			}),
			input,
		);

		expect(seen).toEqual([input]);
	});

	it("gives each run its own state", async () => {
		const workflow = define();
		const input = createFakeBuildContextInput();

		const first = await createWorkflowContext(workflow, input);
		const second = await createWorkflowContext(workflow, input);

		first.state.hits = 5;

		expect(second.state.hits).toBe(0);
	});

	// The assertion runs on every real run, not only under test: the failure it
	// catches is otherwise invisible until the end-to-end bed is built.
	it("rejects data that does not survive a JSON round trip", async () => {
		await expect(
			createWorkflowContext(
				define({
					buildContext: async () =>
						({ referenceId: "ref", createdAt: new Date(0) }) as never as Data,
				}),
				createFakeBuildContextInput(),
			),
		).rejects.toThrow(WorkflowError);
	});
});
