import { getWorkflowVersionLabel } from "@analyses/utils";
import { describe, expect, it } from "vitest";

describe("getWorkflowVersionLabel", () => {
	it("returns the version verbatim when one was recorded", () => {
		expect(getWorkflowVersionLabel("1.2.3")).toBe("1.2.3");
	});

	it("distinguishes a never-recorded version from a recorded-but-unknown one", () => {
		expect(getWorkflowVersionLabel(null)).toBe("not recorded");
		expect(getWorkflowVersionLabel("UNKNOWN")).toBe("Unknown");
	});
});
