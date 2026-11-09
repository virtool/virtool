import { describe, expect, it } from "vitest";
import {
	byteSize,
	pluralize,
	toGcContent,
	toScientificNotation,
	toThousand,
} from "../format";

describe("byteSize()", () => {
	it("should convert 1 to 1.0B", () => {
		const result = byteSize(1);
		expect(result).toEqual("1.0B");
	});

	it("should convert 1024000 to 1.0MB", () => {
		const result = byteSize(1024000);
		expect(result).toEqual("1.0MB");
	});

	it("should convert 1024 to 1.0KB", () => {
		const result = byteSize(1024);
		expect(result).toEqual("1.0KB");
	});

	it("should convert 0 to 0.0B", () => {
		const result = byteSize(0);
		expect(result).toEqual("0.0B");
	});

	it("should convert NaN to 0.0B", () => {
		const result = byteSize(NaN);
		expect(result).toEqual("0.0B");
	});

	it("should convert null to 0.0B", () => {
		const result = byteSize(null);
		expect(result).toEqual("0.0B");
	});
});

describe("toThousand()", () => {
	it("should group thousands with commas", () => {
		expect(toThousand(1234)).toEqual("1,234");
	});

	it("should format millions", () => {
		expect(toThousand(1234567)).toEqual("1,234,567");
	});

	it("should leave values below 1000 ungrouped", () => {
		expect(toThousand(999)).toEqual("999");
	});

	it("should round to a whole number", () => {
		expect(toThousand(1234.6)).toEqual("1,235");
	});
});

describe("toScientificNotation()", () => {
	it("should render zero as a plain 0", () => {
		expect(toScientificNotation(0)).toEqual("0");
	});

	it("should use scientific notation for values below 0.01", () => {
		expect(toScientificNotation(0.001)).toEqual("1.00E-3");
	});

	it("should use scientific notation for values above 1000", () => {
		expect(toScientificNotation(5000)).toEqual("5.00E3");
	});

	it("should use three decimal places for mid-range values", () => {
		expect(toScientificNotation(0.4123)).toEqual("0.412");
	});

	it("should not group the integer part of mid-range values", () => {
		expect(toScientificNotation(1000)).toEqual("1000.000");
	});
});

describe("pluralize()", () => {
	it("should keep the singular noun when the count is one", () => {
		expect(pluralize(1, "read position")).toEqual("1 read position");
	});

	it("should append 's' when the count is not one", () => {
		expect(pluralize(3, "read position")).toEqual("3 read positions");
		expect(pluralize(0, "nucleotide")).toEqual("0 nucleotides");
	});

	it("should use an explicit plural for irregular nouns", () => {
		expect(pluralize(2, "index", "indices")).toEqual("2 indices");
	});
});

describe("toGcContent()", () => {
	it("should render a fraction as a one-decimal percentage", () => {
		expect(toGcContent(0.452)).toEqual("45.2%");
	});

	it("should round to one decimal place", () => {
		expect(toGcContent(0.4127)).toEqual("41.3%");
	});

	it("should handle a whole fraction", () => {
		expect(toGcContent(1)).toEqual("100.0%");
	});
});
