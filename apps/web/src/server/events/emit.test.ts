import { beforeEach, describe, expect, it, vi } from "vitest";

const notify = vi.fn().mockResolvedValue(undefined);

vi.mock("../db/pg", () => ({
	client: { notify },
	db: {},
}));

vi.mock("../logger", () => ({
	logger: { debug: vi.fn(), error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

const { emit } = await import("./emit");

beforeEach(() => {
	notify.mockClear();
});

describe("emit", () => {
	it("publishes a create event with the python-compatible payload", async () => {
		await emit("labels", 7, "create");

		expect(notify).toHaveBeenCalledTimes(1);
		expect(notify).toHaveBeenCalledWith(
			"client_events",
			JSON.stringify({
				domain: "labels",
				resource_id: 7,
				operation: "create",
			}),
		);
	});

	it("publishes a delete event", async () => {
		await emit("labels", 12, "delete");

		expect(notify).toHaveBeenCalledWith(
			"client_events",
			JSON.stringify({
				domain: "labels",
				resource_id: 12,
				operation: "delete",
			}),
		);
	});

	// `roles` is the only domain keyed by a string — an administrator role name.
	// Every other domain is keyed by a Postgres integer, and typing one as a
	// string here would have the client reject every frame it emits.
	it("accepts string resource ids", async () => {
		await emit("roles", "full", "update");

		expect(notify).toHaveBeenCalledWith(
			"client_events",
			JSON.stringify({
				domain: "roles",
				resource_id: "full",
				operation: "update",
			}),
		);
	});
});
