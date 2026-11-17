import { describe, expect, it } from "vitest";
import { moveColumn } from "../PathoscopeColumns";

describe("moveColumn()", () => {
	const order = ["name", "weight", "coverage", "divider", "depth"] as const;

	it("should reorder within the copied columns", () => {
		expect(moveColumn([...order], "coverage", "name")).toEqual([
			"coverage",
			"name",
			"weight",
			"divider",
			"depth",
		]);
	});

	it("should hide a column moved below the divider", () => {
		expect(moveColumn([...order], "weight", "depth")).toEqual([
			"name",
			"coverage",
			"divider",
			"depth",
			"weight",
		]);
	});

	it("should show a column moved above the divider", () => {
		expect(moveColumn([...order], "depth", "weight")).toEqual([
			"name",
			"depth",
			"weight",
			"coverage",
			"divider",
		]);
	});

	it("should never hide the last shown column", () => {
		const current = [
			"weight",
			"divider",
			"name",
			"coverage",
			"depth",
		] as Parameters<typeof moveColumn>[0];

		expect(moveColumn(current, "weight", "name")).toBe(current);
	});
});
