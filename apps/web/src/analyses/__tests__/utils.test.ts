import { getWorkflowVersionLabel } from "@analyses/utils";
import { describe, expect, it } from "vitest";

describe("getWorkflowVersionLabel", () => {
	it("returns the version verbatim when one was recorded", () => {
		expect(
			getWorkflowVersionLabel({ ready: true, workflowVersion: "1.2.3" }),
		).toBe("1.2.3");
	});

	it("distinguishes a never-recorded version from a recorded-but-unknown one", () => {
		expect(
			getWorkflowVersionLabel({ ready: true, workflowVersion: null }),
		).toBe("not recorded");
		expect(
			getWorkflowVersionLabel({ ready: true, workflowVersion: "UNKNOWN" }),
		).toBe("Unknown");
	});

	it("reads an unready analysis as pending rather than unrecorded", () => {
		expect(
			getWorkflowVersionLabel({ ready: false, workflowVersion: null }),
		).toBe("Pending");
	});
});
