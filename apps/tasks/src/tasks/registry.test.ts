import { TaskName } from "@virtool/contracts";
import { describe, expect, it } from "vitest";
import { taskRegistry } from "./registry";

describe("taskRegistry", () => {
	it("registers every body under its own type", () => {
		for (const [name, def] of Object.entries(taskRegistry)) {
			expect(def.type).toBe(name);
		}
	});

	// `tasks.type` is plain `text` and this union bounds nothing about the column,
	// but a body registered under a name Python's runner does not know is one no
	// spawner will ever create a row for.
	it("registers only names Virtool runs", () => {
		for (const name of Object.keys(taskRegistry)) {
			expect(TaskName.options).toContain(name);
		}
	});
});
