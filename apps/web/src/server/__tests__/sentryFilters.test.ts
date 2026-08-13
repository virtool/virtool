import type { ErrorEvent, EventHint } from "@sentry/tanstackstart-react";
import {
	CLIENT_ERROR_NAME,
	FORBIDDEN_ERROR_NAME,
	UNAUTHORIZED_ERROR_NAME,
} from "@virtool/contracts";
import { describe, expect, it } from "vitest";

import { ClientError } from "../errors";
import { dropExpectedClientErrors } from "../sentryFilters";

function namedError(name: string, message: string): Error {
	const error = new Error(message);
	error.name = name;
	return error;
}

function eventWithType(type: string): ErrorEvent {
	return { exception: { values: [{ type }] } } as ErrorEvent;
}

/** The shape node's `abortIncoming` produces: a plain `Error` carrying a code. */
function connResetError(message: string): Error {
	return Object.assign(new Error(message), { code: "ECONNRESET" });
}

/** The reason node mints for a bare `abort()`, as srvx fires on a closed socket. */
function bareAbortReason(): unknown {
	const controller = new AbortController();
	controller.abort();
	return controller.signal.reason;
}

describe("dropExpectedClientErrors", () => {
	it("drops an event whose original exception is an UnauthorizedError", () => {
		const result = dropExpectedClientErrors(
			{} as ErrorEvent,
			{
				originalException: namedError(UNAUTHORIZED_ERROR_NAME, "Unauthorized"),
			} as EventHint,
		);

		expect(result).toBeNull();
	});

	it("drops an event whose original exception is a ForbiddenError", () => {
		const result = dropExpectedClientErrors(
			{} as ErrorEvent,
			{
				originalException: namedError(FORBIDDEN_ERROR_NAME, "Forbidden"),
			} as EventHint,
		);

		expect(result).toBeNull();
	});

	it("drops an event whose original exception is a ClientError", () => {
		const result = dropExpectedClientErrors(
			{} as ErrorEvent,
			{
				originalException: new ClientError("Invalid handle or password."),
			} as EventHint,
		);

		expect(result).toBeNull();
	});

	it("drops an event that reports an expected error type when the original exception is absent", () => {
		const event = eventWithType(UNAUTHORIZED_ERROR_NAME);

		expect(dropExpectedClientErrors(event, {} as EventHint)).toBeNull();
	});

	it("drops an event that reports a ClientError type when the original exception is absent", () => {
		const event = eventWithType(CLIENT_ERROR_NAME);

		expect(dropExpectedClientErrors(event, {} as EventHint)).toBeNull();
	});

	it("drops the error node raises when a client goes away mid-request", () => {
		const result = dropExpectedClientErrors(eventWithType("Error"), {
			originalException: connResetError("aborted"),
		} as EventHint);

		expect(result).toBeNull();
	});

	it("keeps an ECONNRESET from a connection this side opened", () => {
		const event = eventWithType("Error");
		const hint = {
			originalException: connResetError("read ECONNRESET"),
		} as EventHint;

		expect(dropExpectedClientErrors(event, hint)).toBe(event);
	});

	it("keeps an aborted error that carries no ECONNRESET code", () => {
		const event = eventWithType("Error");
		const hint = { originalException: new Error("aborted") } as EventHint;

		expect(dropExpectedClientErrors(event, hint)).toBe(event);
	});

	it("drops the abort srvx raises when a response outlives its client", () => {
		const result = dropExpectedClientErrors(eventWithType("AbortError"), {
			originalException: bareAbortReason(),
		} as EventHint);

		expect(result).toBeNull();
	});

	it("keeps the timeout error an AbortSignal deadline raises", async () => {
		const signal = AbortSignal.timeout(1);
		await new Promise((resolve) => {
			signal.addEventListener("abort", resolve, { once: true });
		});

		const event = eventWithType("TimeoutError");
		const hint = { originalException: signal.reason } as EventHint;

		expect(dropExpectedClientErrors(event, hint)).toBe(event);
	});

	it("keeps an AbortError aborted with an explicit reason", () => {
		const event = eventWithType("AbortError");
		const hint = {
			originalException: namedError("AbortError", "the pool is draining"),
		} as EventHint;

		expect(dropExpectedClientErrors(event, hint)).toBe(event);
	});

	it("keeps an unrelated error event", () => {
		const event = eventWithType("TypeError");
		const hint = { originalException: new TypeError("boom") } as EventHint;

		expect(dropExpectedClientErrors(event, hint)).toBe(event);
	});

	it("keeps an event with no exception details", () => {
		const event = {} as ErrorEvent;

		expect(dropExpectedClientErrors(event, {} as EventHint)).toBe(event);
	});
});
