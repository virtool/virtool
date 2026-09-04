import { createSerializationAdapter } from "@tanstack/react-router";
import {
	CLIENT_ERROR_NAME,
	FORBIDDEN_ERROR_NAME,
	SETUP_REQUIRED_ERROR_NAME,
	type SetupPurpose,
	UNAUTHORIZED_ERROR_NAME,
} from "@virtool/contracts";

const SERVER_ERROR_NAMES = new Set<string>([
	UNAUTHORIZED_ERROR_NAME,
	FORBIDDEN_ERROR_NAME,
	SETUP_REQUIRED_ERROR_NAME,
	CLIENT_ERROR_NAME,
]);

/** A server error reduced to the fields that survive serialization. */
type SerializedServerError = {
	name: string;
	message: string;
	status?: number;
	/**
	 * Which setup flow the caller has to complete. Carried only by a
	 * `SetupRequiredError`, and the whole of what it says — no token, no session
	 * and nothing about what the holder may do.
	 */
	purpose?: SetupPurpose;
};

/**
 * Carries a server error's `name` — and a `ClientError`'s HTTP `status` —
 * across the server-function boundary.
 *
 * TanStack Router's built-in `ShallowErrorPlugin` matches every `Error` and
 * serializes only its `message`, so a server function's `UnauthorizedError`
 * reaches the client as a plain `Error` named `"Error"`. That erases the one
 * field the query retry guard and `handleQueryError` use to recognize
 * a 401/403 — without it, an auth failure is retried ~4× with backoff before
 * the guard can bounce to the login wall. It erases a `ClientError`'s `status`
 * too, which is what a route loader reads to turn a 404 into `notFound()`, and
 * a `SetupRequiredError`'s `purpose`, which is the only thing telling the
 * router which setup surface a restricted caller belongs on.
 * Registered adapters run before the default plugins, so this one
 * re-serializes our own errors with those fields intact and rebuilds them
 * client-side. Everything else still falls through to `ShallowErrorPlugin`
 * unchanged.
 */
export const serverErrorSerializationAdapter = createSerializationAdapter<
	Error,
	SerializedServerError
>({
	key: "ServerError",
	test: (value): value is Error =>
		value instanceof Error && SERVER_ERROR_NAMES.has(value.name),
	toSerializable: (error) => ({
		name: error.name,
		message: error.message,
		status: (error as { status?: number }).status,
		purpose: (error as { purpose?: SetupPurpose }).purpose,
	}),
	fromSerializable: ({ name, message, status, purpose }) => {
		const error = new Error(message);
		error.name = name;
		if (status !== undefined) {
			Object.assign(error, { status });
		}
		if (purpose !== undefined) {
			Object.assign(error, { purpose });
		}
		return error;
	},
});
