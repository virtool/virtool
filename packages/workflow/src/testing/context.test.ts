import { describe, expect, it } from "vitest";
import { defineWorkflow } from "../step";
import {
	createFakeIndex,
	createFakeSample,
	createFakeSubtraction,
} from "./builders";
import { buildTestContext, createFakeContext } from "./context";

/** The data half a real workflow's `buildContext` would produce. */
function buildData() {
	return {
		index: createFakeIndex(),
		sample: createFakeSample(),
		subtraction: createFakeSubtraction(),
	};
}

const workflow = defineWorkflow({
	name: "create_subtraction",
	buildContext: async () => buildData(),
	createState: () => ({ count: 0 }),
	steps: [
		{
			id: "prepare",
			description: "Prepare the run.",
			run: async () => {},
		},
	],
});

describe("buildTestContext", () => {
	it("runs the workflow's own buildContext", async () => {
		const context = await buildTestContext(workflow);

		expect(context.data).toEqual(buildData());
		expect(context.state).toEqual({ count: 0 });
	});

	// The seam the deferred end-to-end bed stands on: a run there is files plus a
	// JSON blob, and it rots silently the first time someone parks a closure or
	// an open handle on `data`.
	it("produces data that survives a JSON round trip unchanged", async () => {
		const { data } = await buildTestContext(workflow);

		expect(JSON.parse(JSON.stringify(data))).toEqual(data);
	});

	it("refuses data that does not survive one", async () => {
		const broken = defineWorkflow({
			name: "create_subtraction",
			buildContext: async () => ({ read: () => "bytes" }),
			createState: () => ({}),
			steps: [
				{ id: "prepare", description: "Prepare the run.", run: async () => {} },
			],
		});

		await expect(buildTestContext(broken)).rejects.toThrow();
	});

	it("takes overrides for the input a workflow is handed", async () => {
		const context = await buildTestContext(workflow, {
			workPath: "/tmp/somewhere",
			proc: 8,
		});

		expect(context.workPath).toBe("/tmp/somewhere");
		expect(context.proc).toBe(8);
	});
});

describe("createFakeContext", () => {
	it("takes data and state directly, skipping buildContext", () => {
		const context = createFakeContext({ id: 1 }, { done: false });

		expect(context.data).toEqual({ id: 1 });
		expect(context.state).toEqual({ done: false });
	});

	it("defaults to a jobs API client that refuses every call", async () => {
		const context = createFakeContext({}, {});

		await expect(context.client.getJob()).rejects.toThrow(
			"jobs API client getJob was called in a test",
		);
	});
});
