import { CLIENT_ERROR_NAME } from "@virtool/contracts";
import { describe, expect, it } from "vitest";
import { getWallErrorMessage } from "../errors";

function clientError(message: string): Error {
	const error = new Error(message);
	error.name = CLIENT_ERROR_NAME;
	return error;
}

describe("getWallErrorMessage()", () => {
	it.each<[string, unknown, string]>([
		[
			"show a client error's message",
			clientError("Handle taken."),
			"Handle taken.",
		],
		[
			"fall back when a client error has no message",
			clientError(""),
			"Fallback.",
		],
		// Anything else can hold library or provider details.
		[
			"hide an unexpected error's message",
			new Error("BETTER_AUTH internal detail"),
			"Fallback.",
		],
		["fall back for a value that is not an error", undefined, "Fallback."],
	])("should %s", (_, error, expected) => {
		expect(getWallErrorMessage(error, "Fallback.")).toBe(expected);
	});
});
