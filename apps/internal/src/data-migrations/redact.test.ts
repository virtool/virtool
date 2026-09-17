import { describe, expect, it } from "vitest";

import { describeError, redactSecrets } from "./redact";

describe("redactSecrets", () => {
	it("mask the password in a connection url and keep the rest", () => {
		expect(
			redactSecrets(
				"could not connect to postgres://virtool:hunter2@db.internal:5432/virtool",
			),
		).toBe(
			"could not connect to postgres://virtool:[redacted]@db.internal:5432/virtool",
		);
	});

	it("mask an assigned secret whatever the separator", () => {
		expect(redactSecrets("rejected option password=hunter2")).toBe(
			"rejected option password=[redacted]",
		);
		expect(redactSecrets('sent {"api_key": "sk-live-1234"} upstream')).toBe(
			'sent {"api_key": [redacted]} upstream',
		);
		expect(redactSecrets("Authorization: Bearer abc.def")).toBe(
			"Authorization: [redacted]",
		);
	});

	it("leave a message carrying no credential alone", () => {
		const message = 'relation "users" does not exist at row 41';

		expect(redactSecrets(message)).toBe(message);
	});

	it("leave a bare mention of a secret's name alone", () => {
		const message = "the setup token 7 had already been spent";

		expect(redactSecrets(message)).toBe(message);
	});
});

describe("describeError", () => {
	it("collapse the message to one redacted line", () => {
		const err = new Error(
			"connection failed\n  url=postgres://virtool:hunter2@db:5432/virtool",
		);

		expect(describeError(err)).toBe(
			"connection failed url=postgres://virtool:[redacted]@db:5432/virtool",
		);
	});

	it("say so when the thrown value was not an error", () => {
		expect(describeError("nope")).toBe("non-error thrown: nope");
	});
});
