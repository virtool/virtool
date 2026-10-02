import { describe, expect, it } from "vitest";
import { isReservedHandle } from "./handle";

describe("isReservedHandle", () => {
	it("matches the reserved handle in any case", () => {
		expect(isReservedHandle("virtool")).toBe(true);
		expect(isReservedHandle("ViRtOoL")).toBe(true);
	});

	it("does not match other handles", () => {
		expect(isReservedHandle("virtool2")).toBe(false);
		expect(isReservedHandle("ian")).toBe(false);
	});
});
