import { UploadTooLargeError } from "@virtool/contracts";
import {
	UploadIncompleteError,
	UploadNotFoundError,
	UploadReservedError,
	UploadSizeMismatchError,
} from "@virtool/data/uploads/data";
import { describe, expect, it, vi } from "vitest";

vi.mock("../composition", () => ({ db: {}, storage: {} }));
vi.mock("../config", () => ({ config: {} }));
vi.mock("../logger", () => ({ logger: {} }));

const { getUploadErrorResponse } = await import("./errors");
const { DirectUploadUnavailableError } = await import("./service");

describe("getUploadErrorResponse", () => {
	it.each([
		[new UploadNotFoundError(), 404, "Upload not found."],
		[new UploadReservedError(), 409, "Upload is reserved and in use."],
		[new UploadIncompleteError(), 409, "Upload is not complete."],
		[
			new UploadSizeMismatchError(),
			409,
			"Upload size does not match the declared size.",
		],
		[
			new UploadTooLargeError(1024),
			413,
			"File exceeds the maximum upload size of 1,024 bytes.",
		],
		[
			new DirectUploadUnavailableError("Direct uploads are unavailable."),
			503,
			"Direct uploads are unavailable.",
		],
	])("maps %o to %i", (err, status, message) => {
		expect(getUploadErrorResponse(err)).toEqual({ status, message });
	});

	it("returns null for an unexpected error", () => {
		expect(getUploadErrorResponse(new Error("boom"))).toBeNull();
	});
});
