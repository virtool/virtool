import { CLIENT_ERROR_NAME } from "@virtool/contracts";
import { describe, expect, it } from "vitest";
import { getDeleteErrorMessage } from "../deleteError";

function namedError(name: string, message: string): Error {
	const error = new Error(message);
	error.name = name;
	return error;
}

const fallback = "Something went wrong. Please try again.";

describe("getDeleteErrorMessage()", () => {
	it.each<[string, unknown, string | null]>([
		[
			"show a client error's message",
			namedError(CLIENT_ERROR_NAME, "Cannot delete this."),
			"Cannot delete this.",
		],
		[
			"fall back when a client error carries no message",
			namedError(CLIENT_ERROR_NAME, ""),
			fallback,
		],
		// Anything but a `ClientError` may carry a database or storage diagnostic.
		[
			"hide an unexpected error's message",
			new Error(
				'duplicate key value violates unique constraint "samples_pkey"',
			),
			fallback,
		],
		["fall back for a value that is not an error", "nope", fallback],
		[
			"say nothing when recent authentication is cancelled",
			namedError("RecentAuthenticationCancelled", "Cancelled."),
			null,
		],
	])("should %s", (_, error, expected) => {
		expect(getDeleteErrorMessage(error)).toBe(expected);
	});
});
