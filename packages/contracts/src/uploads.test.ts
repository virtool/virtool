import { describe, expect, it } from "vitest";

import {
	checkUploadSize,
	DEFAULT_MAX_UPLOAD_SIZE,
	formatMaxUploadSizeMessage,
	MAX_UPLOAD_SIZE,
	UploadTooLargeError,
} from "./uploads";

describe("formatMaxUploadSizeMessage", () => {
	it("groups the maximum it was given", () => {
		expect(formatMaxUploadSizeMessage(DEFAULT_MAX_UPLOAD_SIZE)).toBe(
			"File exceeds the maximum upload size of 5,000,000,000 bytes.",
		);
	});
});

describe("checkUploadSize", () => {
	it.each([1, DEFAULT_MAX_UPLOAD_SIZE, MAX_UPLOAD_SIZE])(
		"rejects a file one byte over a maximum of %i",
		(maximum) => {
			expect(() => checkUploadSize(maximum + 1, maximum)).toThrow(
				new UploadTooLargeError(maximum),
			);
		},
	);

	it.each([0, 1, DEFAULT_MAX_UPLOAD_SIZE])(
		"accepts a size of %i at the default maximum",
		(size) => {
			expect(() =>
				checkUploadSize(size, DEFAULT_MAX_UPLOAD_SIZE),
			).not.toThrow();
		},
	);

	it("carries the maximum on the error it raises", () => {
		expect(() => checkUploadSize(10, 5)).toThrow(
			expect.objectContaining({ maximum: 5, name: "UploadTooLargeError" }),
		);
	});
});
