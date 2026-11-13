import { createFakeEmailSettings } from "@tests/fake/email";
import type { EmailSettings } from "@virtool/contracts";
import { describe, expect, it } from "vitest";
import { getEmailStatusPresentation, listMissingFields } from "../emailStatus";

describe("getEmailStatusPresentation()", () => {
	it.each<[EmailSettings["availability"], boolean, string, string]>([
		["ready", true, "Active", "green"],
		// A configured instance with sending turned off is not active.
		["ready", false, "Disabled", "gray"],
		["unconfigured", false, "Needs Configuration", "orange"],
		// An undecryptable key is intact, so it is never reported as missing.
		["configuration_error", false, "Configuration Error", "red"],
	])(
		"should present %s with sending %s as %s",
		(availability, enabled, label, color) => {
			expect(
				getEmailStatusPresentation({ availability, enabled }),
			).toMatchObject({ color, label });
		},
	);
});

describe("listMissingFields()", () => {
	it.each([
		[false, "", "an API key and a sender address"],
		[false, "virtool@example.com", "an API key"],
		[true, "", "a sender address"],
	])(
		"should name what is missing with a key %s and sender %j",
		(hasApiKey, senderAddress, expected) => {
			expect(
				listMissingFields(
					createFakeEmailSettings({ hasApiKey, senderAddress }),
				),
			).toBe(expected);
		},
	);
});
