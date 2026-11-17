import { describe, expect, it } from "vitest";
import { getPasswordMismatchError } from "../password";

describe("getPasswordMismatchError()", () => {
	it("should accept a matching confirmation", () => {
		expect(
			getPasswordMismatchError("hunter2-hunter2", "hunter2-hunter2"),
		).toBeNull();
	});

	it.each(["another-password", "", "Hunter2-hunter2"])(
		"should refuse the confirmation %j",
		(confirmation) => {
			expect(getPasswordMismatchError("hunter2-hunter2", confirmation)).toBe(
				"The passwords do not match",
			);
		},
	);
});
