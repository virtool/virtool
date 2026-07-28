import { describe, expect, it } from "vitest";
import { eventToSseMessage } from "./broadcast";

describe("eventToSseMessage", () => {
	it("maps create to insert with the resource id", () => {
		expect(
			eventToSseMessage({
				domain: "labels",
				resource_id: 4,
				operation: "create",
			}),
		).toEqual({
			domain: "labels",
			operation: "insert",
			id: 4,
		});
	});

	it("maps update to update with the resource id", () => {
		expect(
			eventToSseMessage({
				domain: "labels",
				resource_id: 5,
				operation: "update",
			}),
		).toEqual({
			domain: "labels",
			operation: "update",
			id: 5,
		});
	});

	it("maps delete to delete with the resource id", () => {
		expect(
			eventToSseMessage({
				domain: "labels",
				resource_id: 9,
				operation: "delete",
			}),
		).toEqual({
			domain: "labels",
			operation: "delete",
			id: 9,
		});
	});

	it("preserves string resource ids", () => {
		expect(
			eventToSseMessage({
				domain: "roles",
				resource_id: "full",
				operation: "create",
			}),
		).toEqual({
			domain: "roles",
			operation: "insert",
			id: "full",
		});
	});
});
