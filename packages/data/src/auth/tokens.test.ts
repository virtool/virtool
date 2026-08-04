import { describe, expect, it } from "vitest";

import { hashToken, newSessionId, newSessionToken } from "./tokens";

describe("newSessionId", () => {
	it('produces a "session_" + 96 hex chars value matching the Python format', () => {
		const id = newSessionId();
		expect(id).toMatch(/^session_[0-9a-f]{96}$/);
	});

	it("produces distinct ids across many calls", () => {
		const seen = new Set<string>();
		for (let i = 0; i < 1000; i++) {
			seen.add(newSessionId());
		}
		expect(seen.size).toBe(1000);
	});
});

describe("newSessionToken", () => {
	it("produces a 64-character hex string", () => {
		expect(newSessionToken()).toMatch(/^[0-9a-f]{64}$/);
	});

	it("produces distinct tokens across many calls", () => {
		const seen = new Set<string>();
		for (let i = 0; i < 1000; i++) {
			seen.add(newSessionToken());
		}
		expect(seen.size).toBe(1000);
	});
});

describe("hashToken", () => {
	it("matches the known SHA-256 of a known input", () => {
		// echo -n "hunter2" | sha256sum
		expect(hashToken("hunter2")).toBe(
			"f52fbd32b2b3b86ff88ef6c490628285f482af15ddcb29541f94bcf526a3f6c7",
		);
	});

	it("is deterministic", () => {
		const token = newSessionToken();
		expect(hashToken(token)).toBe(hashToken(token));
	});
});
