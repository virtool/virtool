import { describe, expect, it } from "vitest";
import { isCsrfCandidate } from "../csrf";

function candidate(
	method: string,
	pathname: string,
	headers: Record<string, string> = {},
	handlerType: "serverFn" | "router" = "router",
) {
	return {
		request: new Request(`http://localhost:3000${pathname}`, {
			method,
			headers,
		}),
		pathname,
		handlerType,
	};
}

describe("isCsrfCandidate", () => {
	it("checks every server function", () => {
		expect(
			isCsrfCandidate(candidate("POST", "/_serverFn/abc", {}, "serverFn")),
		).toBe(true);
	});

	it.each([
		["POST", "/api/v1/uploads"],
		["POST", "/api/v1/uploads/1/finalize"],
		["DELETE", "/api/v1/uploads/1"],
		["POST", "/API/V1/uploads"],
	])("checks a cookie-authenticated %s %s", (method, pathname) => {
		expect(isCsrfCandidate(candidate(method, pathname))).toBe(true);
	});

	it("skips a request that sends an API key", () => {
		expect(
			isCsrfCandidate(
				candidate("POST", "/api/v1/uploads", {
					authorization: "Basic dXNlcjprZXk=",
				}),
			),
		).toBe(false);
	});

	it.each(["GET", "HEAD", "OPTIONS"])("skips a safe %s request", (method) => {
		expect(isCsrfCandidate(candidate(method, "/api/v1/uploads"))).toBe(false);
	});

	it("leaves Better Auth to its own origin check", () => {
		expect(
			isCsrfCandidate(
				candidate("POST", "/api/auth/passkey/verify-registration"),
			),
		).toBe(false);
	});

	it("skips page loads", () => {
		expect(isCsrfCandidate(candidate("GET", "/samples"))).toBe(false);
	});
});
