import { describe, expect, it } from "vitest";
import { eventToSseMessage, isEventForUser } from "./broadcast";

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

describe("isEventForUser", () => {
	it("passes an account event to the user it names", () => {
		expect(
			isEventForUser(
				{ domain: "account", resource_id: 3, operation: "update" },
				3,
			),
		).toBe(true);
	});

	it("withholds an account event from every other user", () => {
		expect(
			isEventForUser(
				{ domain: "account", resource_id: 3, operation: "update" },
				4,
			),
		).toBe(false);
	});

	it("passes events in other domains to every user", () => {
		expect(
			isEventForUser(
				{ domain: "users", resource_id: 3, operation: "update" },
				4,
			),
		).toBe(true);
	});
});
