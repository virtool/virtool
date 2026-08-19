import { SseDomainSchema, SseMessageSchema } from "@virtool/contracts";
import { describe, expect, it } from "vitest";

describe("SseMessageSchema", () => {
	it("accepts a frame for a number-id domain", () => {
		const result = SseMessageSchema.safeParse({
			domain: "labels",
			operation: "update",
			id: 4,
		});
		expect(result.success).toBe(true);
		expect(result.data).toEqual({
			domain: "labels",
			operation: "update",
			id: 4,
		});
	});

	it("accepts a frame for a string-id domain", () => {
		const result = SseMessageSchema.safeParse({
			domain: "roles",
			operation: "insert",
			id: "full",
		});
		expect(result.success).toBe(true);
	});

	it("accepts a frame for every domain in the enum", () => {
		for (const domain of SseDomainSchema.options) {
			const stringId = domain === "roles";
			const result = SseMessageSchema.safeParse({
				domain,
				operation: "update",
				id: stringId ? "abc" : 1,
			});
			expect(result.success).toBe(true);
		}
	});

	it("strips unknown fields", () => {
		const result = SseMessageSchema.safeParse({
			domain: "labels",
			operation: "update",
			id: 1,
			extra: "junk",
		});
		expect(result.success).toBe(true);
		expect(result.data).toEqual({
			domain: "labels",
			operation: "update",
			id: 1,
		});
	});

	it("rejects a number id for a string-id domain", () => {
		const result = SseMessageSchema.safeParse({
			domain: "roles",
			operation: "update",
			id: 7,
		});
		expect(result.success).toBe(false);
	});

	// Every domain but `roles` is keyed by a Postgres integer. Typing one as a
	// string rejects every frame published for it and drops the invalidation it
	// carried — which is what happened to `samples` (VIR-2794), and to `indexes`
	// and `references` until they were corrected too.
	it("accepts the integer ids emitted for indexes and references", () => {
		for (const domain of ["indexes", "references"]) {
			const result = SseMessageSchema.safeParse({
				domain,
				operation: "update",
				id: 7,
			});
			expect(result.success).toBe(true);
		}
	});

	it("rejects a string id for a number-id domain", () => {
		const result = SseMessageSchema.safeParse({
			domain: "labels",
			operation: "update",
			id: "abc",
		});
		expect(result.success).toBe(false);
	});

	it("rejects messages with an unsupported operation", () => {
		const result = SseMessageSchema.safeParse({
			domain: "samples",
			operation: "patch",
			id: 1,
		});
		expect(result.success).toBe(false);
	});

	it("rejects messages with an unknown domain", () => {
		const result = SseMessageSchema.safeParse({
			domain: "unknown",
			operation: "update",
			id: 1,
		});
		expect(result.success).toBe(false);
	});

	it("rejects messages without an id", () => {
		const result = SseMessageSchema.safeParse({
			domain: "samples",
			operation: "update",
		});
		expect(result.success).toBe(false);
	});

	it("rejects messages without a domain", () => {
		const result = SseMessageSchema.safeParse({
			operation: "update",
			id: 1,
		});
		expect(result.success).toBe(false);
	});
});
