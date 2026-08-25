import { describe, expect, it } from "vitest";
import { taskRegistry } from "./registry";

describe("taskRegistry", () => {
	it("registers every body under its own type", () => {
		for (const [name, def] of Object.entries(taskRegistry)) {
			expect(def.type).toBe(name);
		}
	});
});
