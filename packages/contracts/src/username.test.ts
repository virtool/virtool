import { describe, expect, it } from "vitest";
import {
	isReservedUsername,
	isValidUsername,
	normalizeUsername,
} from "./username";

describe("normalizeUsername", () => {
	it("trims and lowercases", () => {
		expect(normalizeUsername("  Ada.Lovelace ")).toBe("ada.lovelace");
	});
});

describe("isValidUsername", () => {
	it("accepts lowercase letters, numbers, _ and .", () => {
		expect(isValidUsername("ada_1.x")).toBe(true);
	});

	it("rejects uppercase", () => {
		expect(isValidUsername("Ada")).toBe(false);
	});

	it("rejects other characters", () => {
		expect(isValidUsername("ada-l")).toBe(false);
	});

	it("rejects lengths outside 3 to 30", () => {
		expect(isValidUsername("ad")).toBe(false);
		expect(isValidUsername("a".repeat(31))).toBe(false);
	});
});

describe("isReservedUsername", () => {
	it("matches the reserved username in any case", () => {
		expect(isReservedUsername("virtool")).toBe(true);
		expect(isReservedUsername("ViRtOoL")).toBe(true);
	});

	it("does not match other usernames", () => {
		expect(isReservedUsername("virtool2")).toBe(false);
		expect(isReservedUsername("ian")).toBe(false);
	});
});
