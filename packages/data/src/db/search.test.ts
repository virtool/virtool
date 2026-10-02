import { describe, expect, it } from "vitest";

import { toSearchPattern } from "./search";

describe("toSearchPattern", () => {
	it("wraps the term in wildcards", () => {
		expect(toSearchPattern("abc")).toBe("%abc%");
	});

	it("escapes LIKE metacharacters", () => {
		expect(toSearchPattern("50%_a\\b")).toBe("%50\\%\\_a\\\\b%");
	});
});
