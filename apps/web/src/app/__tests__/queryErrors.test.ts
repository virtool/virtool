import {
	getErrorStatus,
	handleQueryError,
	type QueryError,
	shouldRetryQuery,
} from "@app/queryErrors";
import {
	CLIENT_ERROR_NAME,
	FORBIDDEN_ERROR_NAME,
	UNAUTHORIZED_ERROR_NAME,
} from "@virtool/contracts";
import { afterEach, describe, expect, it, vi } from "vitest";

const { endSession } = vi.hoisted(() => ({ endSession: vi.fn() }));

vi.mock("@app/session", () => ({
	armSessionEnd: vi.fn(),
	endSession,
}));

const { captureException } = vi.hoisted(() => ({ captureException: vi.fn() }));

vi.mock("@sentry/tanstackstart-react", () => ({ captureException }));

// A rejected `.parse()` reaches these functions as a `ZodError`, recognized by
// its `name` so the guard need not import zod. A plain Error with the name set
// is exactly that shape.
function validationError(): Error {
	const error = new Error("index.id: expected string, received number");
	error.name = "ZodError";
	return error;
}

// The auth errors arrive rebuilt by `serverErrorSerializationAdapter`, which
// carries `name` but nothing else for them — so a plain Error with the name set
// is exactly what these functions see in production.
function serializedAuthError(name: string, message: string): Error {
	const error = new Error(message);
	error.name = name;
	return error;
}

// A ClientError as it arrives rebuilt by `serverErrorSerializationAdapter`,
// with the status as an own property.
function clientError(status: number): QueryError {
	const error = Object.assign(new Error(`Request failed: ${status}`), {
		status,
	});
	error.name = CLIENT_ERROR_NAME;
	return error;
}

describe("getErrorStatus", () => {
	it("reads the status a server function's ClientError carries", () => {
		expect(getErrorStatus(clientError(404))).toBe(404);
	});

	it.each([
		["an error carrying no status", new Error("network down")],
		["a non-object", "boom"],
		["null", null],
		["undefined", undefined],
	])("returns undefined for %s", (_label, error) => {
		expect(getErrorStatus(error)).toBeUndefined();
	});
});

describe("shouldRetryQuery", () => {
	it("retries a server function failure that may yet succeed", () => {
		expect(shouldRetryQuery(0, clientError(500))).toBe(true);
	});

	it.each([401, 403, 404])(
		"gives up immediately on a %i from a server function",
		(status) => {
			expect(shouldRetryQuery(0, clientError(status))).toBe(false);
		},
	);

	it.each([UNAUTHORIZED_ERROR_NAME, FORBIDDEN_ERROR_NAME])(
		"gives up immediately on a server function's %s",
		(name) => {
			expect(shouldRetryQuery(0, serializedAuthError(name, name))).toBe(false);
		},
	);

	it("keeps retrying an auth error whose name was lost in serialization", () => {
		// Guards the adapter's whole reason for existing: without `name`, an
		// UnauthorizedError is indistinguishable from a transient failure and is
		// retried ~4× over ~15s before the user reaches the login wall. See
		// VIR-2783 for the end-to-end coverage this cannot provide.
		expect(shouldRetryQuery(0, new Error("Unauthorized"))).toBe(true);
	});

	it("retries an unrecognized failure a bounded number of times", () => {
		const error = new Error("network down");

		expect(shouldRetryQuery(3, error)).toBe(true);
		expect(shouldRetryQuery(4, error)).toBe(false);
	});

	it("gives up immediately on a validation failure that cannot recover", () => {
		expect(shouldRetryQuery(0, validationError())).toBe(false);
	});
});

describe("handleQueryError", () => {
	afterEach(() => {
		endSession.mockClear();
		captureException.mockClear();
	});

	it("ends the session when a server function rejects the session", () => {
		handleQueryError(
			serializedAuthError(UNAUTHORIZED_ERROR_NAME, "Unauthorized"),
		);

		expect(endSession).toHaveBeenCalledTimes(1);
	});

	it("leaves the session alone when the user merely lacks the role", () => {
		handleQueryError(serializedAuthError(FORBIDDEN_ERROR_NAME, "Forbidden"));

		expect(endSession).not.toHaveBeenCalled();
	});

	it("leaves the session alone when a query fails for any other reason", () => {
		handleQueryError(new Error("network down"));

		expect(endSession).not.toHaveBeenCalled();
	});

	it("reports a drifted contract to Sentry so it fails loudly", () => {
		const consoleError = vi
			.spyOn(console, "error")
			.mockImplementation(() => {});
		const error = validationError();

		handleQueryError(error);

		expect(captureException).toHaveBeenCalledWith(error, {
			tags: { contract: "drift" },
		});

		consoleError.mockRestore();
	});

	it("does not report an ordinary failure as contract drift", () => {
		handleQueryError(new Error("network down"));

		expect(captureException).not.toHaveBeenCalled();
	});
});
