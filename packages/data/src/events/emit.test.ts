import type { Logger } from "@virtool/logger";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PgClient } from "../db/pg";
import { createEmitter, emit } from "./emit";

const notify = vi.fn().mockResolvedValue(undefined);

const logger = {
	debug: vi.fn(),
	error: vi.fn(),
	info: vi.fn(),
	warn: vi.fn(),
} as unknown as Logger;

beforeEach(() => {
	vi.clearAllMocks();
	notify.mockResolvedValue(undefined);
	createEmitter({ client: { notify } as unknown as PgClient, logger });
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

	it("reports a failed notify rather than throwing at the call site", async () => {
		const err = new Error("connection closed");
		notify.mockRejectedValueOnce(err);

		await expect(emit("labels", 7, "update")).resolves.toBeUndefined();

		expect(logger.error).toHaveBeenCalledWith(
			expect.objectContaining({ err }),
			"failed to emit client event",
		);
	});
});
