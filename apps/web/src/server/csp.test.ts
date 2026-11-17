import { describe, expect, it } from "vitest";
import { buildContentSecurityPolicy } from "./csp";

function getDirective(policy: string, name: string) {
	return policy.split("; ").find((directive) => directive.startsWith(name));
}

describe("buildContentSecurityPolicy", () => {
	it("allows the website for connections and images", () => {
		const policy = buildContentSecurityPolicy("nonce", [
			"https://storage.test",
		]);

		expect(getDirective(policy, "connect-src")).toBe(
			"connect-src 'self' https://www.virtool.ca https://storage.test",
		);
		expect(getDirective(policy, "img-src")).toBe(
			"img-src 'self' data: https://www.virtool.ca",
		);
	});
});
