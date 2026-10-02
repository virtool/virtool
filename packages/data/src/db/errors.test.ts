import { describe, expect, it } from "vitest";

import { isForeignKeyViolation, isUniqueViolation } from "./errors";

const unique = { code: "23505", constraint_name: "things_name_key" };
const foreignKey = { code: "23503", constraint_name: "things_owner_id_fkey" };

describe("isUniqueViolation", () => {
	it("matches the error or its cause", () => {
		expect(isUniqueViolation(unique)).toBe(true);
		expect(isUniqueViolation(new Error("query", { cause: unique }))).toBe(true);
	});

	it("filters by constraint name", () => {
		expect(isUniqueViolation(unique, ["things_name_key"])).toBe(true);
		expect(isUniqueViolation(unique, ["other_key"])).toBe(false);
	});

	it("rejects other codes and non-objects", () => {
		expect(isUniqueViolation(foreignKey)).toBe(false);
		expect(isUniqueViolation(null)).toBe(false);
		expect(isUniqueViolation("23505")).toBe(false);
	});
});

describe("isForeignKeyViolation", () => {
	it("matches the error or its cause", () => {
		expect(isForeignKeyViolation(foreignKey)).toBe(true);
		expect(
			isForeignKeyViolation(new Error("query", { cause: foreignKey })),
		).toBe(true);
	});

	it("filters by constraint name", () => {
		expect(isForeignKeyViolation(foreignKey, ["things_owner_id_fkey"])).toBe(
			true,
		);
		expect(isForeignKeyViolation(foreignKey, ["other_fkey"])).toBe(false);
	});

	it("rejects other codes", () => {
		expect(isForeignKeyViolation(unique)).toBe(false);
	});
});
