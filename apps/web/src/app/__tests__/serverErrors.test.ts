import { serverErrorSerializationAdapter } from "@app/serverErrors";
import {
	CLIENT_ERROR_NAME,
	FORBIDDEN_ERROR_NAME,
	UNAUTHORIZED_ERROR_NAME,
} from "@virtool/contracts";
import { describe, expect, it } from "vitest";

function namedError(name: string, message: string): Error {
	const error = new Error(message);
	error.name = name;
	return error;
}

function clientError(message: string, status: number): Error {
	return Object.assign(namedError(CLIENT_ERROR_NAME, message), { status });
}

describe("serverErrorSerializationAdapter", () => {
	it("matches server errors by name", () => {
		expect(
			serverErrorSerializationAdapter.test(
				namedError(UNAUTHORIZED_ERROR_NAME, "Unauthorized"),
			),
		).toBe(true);
		expect(
			serverErrorSerializationAdapter.test(
				namedError(FORBIDDEN_ERROR_NAME, "Forbidden"),
			),
		).toBe(true);
		expect(
			serverErrorSerializationAdapter.test(
				clientError("Reference not found.", 404),
			),
		).toBe(true);
	});

	it("leaves every other error to the default ShallowErrorPlugin", () => {
		expect(serverErrorSerializationAdapter.test(new Error("boom"))).toBe(false);
		expect(
			serverErrorSerializationAdapter.test(namedError("ZodError", "invalid")),
		).toBe(false);
		expect(
			serverErrorSerializationAdapter.test({ name: UNAUTHORIZED_ERROR_NAME }),
		).toBe(false);
		expect(serverErrorSerializationAdapter.test("Unauthorized")).toBe(false);
	});

	it("round-trips an auth error with its name intact", () => {
		const serialized = serverErrorSerializationAdapter.toSerializable(
			namedError(UNAUTHORIZED_ERROR_NAME, "Unauthorized"),
		);
		expect(serialized).toEqual({
			name: UNAUTHORIZED_ERROR_NAME,
			message: "Unauthorized",
			status: undefined,
		});

		const restored =
			serverErrorSerializationAdapter.fromSerializable(serialized);
		expect(restored).toBeInstanceOf(Error);
		expect(restored.name).toBe(UNAUTHORIZED_ERROR_NAME);
		expect(restored.message).toBe("Unauthorized");
		expect(restored).not.toHaveProperty("status");
	});

	it("round-trips a client error with its status intact", () => {
		const serialized = serverErrorSerializationAdapter.toSerializable(
			clientError("Reference not found.", 404),
		);
		expect(serialized).toEqual({
			name: CLIENT_ERROR_NAME,
			message: "Reference not found.",
			status: 404,
		});

		const restored =
			serverErrorSerializationAdapter.fromSerializable(serialized);
		expect(restored.name).toBe(CLIENT_ERROR_NAME);
		expect(restored.message).toBe("Reference not found.");
		expect((restored as { status?: number }).status).toBe(404);
	});
});
