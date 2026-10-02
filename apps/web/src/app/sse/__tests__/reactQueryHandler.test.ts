import { labelQueryKeys } from "@labels/keys";
import { samplesQueryKeys } from "@samples/keys";
import { QueryClient } from "@tanstack/react-query";
import { taskQueryKeys } from "@tasks/keys";
import type { SseMessage } from "@virtool/contracts";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { reactQueryHandler } from "../reactQueryHandler";
import handlerSource from "../reactQueryHandler.ts?raw";

// The batching queues are covered by their own suites. Stubbing them here keeps
// this file about routing: which frames reach a queue and which reach
// `invalidateQueries`.
const { queueJobRefresh, queueTaskRefresh } = vi.hoisted(() => ({
	queueJobRefresh: vi.fn(),
	queueTaskRefresh: vi.fn(),
}));

vi.mock("@jobs/refresh", () => ({
	createJobRefreshQueue: () => queueJobRefresh,
}));

vi.mock("@tasks/refresh", () => ({
	createTaskRefreshQueue: () => queueTaskRefresh,
}));

describe("reactQueryHandler", () => {
	let queryClient: QueryClient;
	let invalidate: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		queryClient = new QueryClient();
		invalidate = vi.spyOn(queryClient, "invalidateQueries");
		queueJobRefresh.mockClear();
		queueTaskRefresh.mockClear();
	});

	it("refreshes what the change reaches under the shared rule", async () => {
		queryClient.setQueryData(labelQueryKeys.lists(), []);
		queryClient.setQueryData(samplesQueryKeys.detail(4), {});

		reactQueryHandler(queryClient)({
			domain: "labels",
			operation: "update",
			id: 7,
		});

		expect(
			queryClient.getQueryState(labelQueryKeys.lists())?.isInvalidated,
		).toBe(true);
		expect(
			queryClient.getQueryState(samplesQueryKeys.detail(4))?.isInvalidated,
		).toBe(true);
	});

	// Every on-screen job holds its own detail query, so invalidating the frame's
	// detail is a request per running job per progress wave. These frames go to
	// the batching queue instead — see `jobs/__tests__/refresh.test.ts`.
	it("batches job updates rather than invalidating a detail per frame", () => {
		reactQueryHandler(queryClient)({
			domain: "jobs",
			operation: "update",
			id: 42,
		});

		expect(queueJobRefresh).toHaveBeenCalledExactlyOnceWith(42);
		expect(invalidate).not.toHaveBeenCalled();
	});

	// A running task emits a frame per progress step — over a hundred for a
	// reference clone — and every task-bearing row holds its own detail query.
	// These frames go to the batching queue instead — see
	// `tasks/__tests__/refresh.test.ts`.
	it("batches task updates rather than invalidating a detail per frame", () => {
		reactQueryHandler(queryClient)({
			domain: "tasks",
			operation: "update",
			id: 9,
		});

		expect(queueTaskRefresh).toHaveBeenCalledExactlyOnceWith(9);
		expect(invalidate).not.toHaveBeenCalled();
	});

	// Only `update` frames are hot enough to batch. An insert or delete still
	// takes the generic path, so a domain cannot lose them to the queue.
	it("leaves non-update task frames on the invalidation path", () => {
		reactQueryHandler(queryClient)({
			domain: "tasks",
			operation: "insert",
			id: 9,
		});

		expect(queueTaskRefresh).not.toHaveBeenCalled();
		expect(invalidate).toHaveBeenCalledWith({
			queryKey: taskQueryKeys.all(),
		});
	});

	it("ignores messages for unknown domains", () => {
		const handle = reactQueryHandler(queryClient);
		handle({
			domain: "unknown",
			operation: "update",
			id: 1,
		} as unknown as SseMessage);
		expect(invalidate).not.toHaveBeenCalled();
	});

	// The handler needs keys, not hooks. Importing a feature's `queries` module
	// for a key drags its `queryFn` bodies — zod, the server function stubs —
	// into the chunk every authenticated page loads, and nothing else would fail
	// if it did.
	it("imports keys only, never a feature's queries module", () => {
		const specifiers = [...handlerSource.matchAll(/from\s+"([^"]+)"/g)].map(
			([, specifier]) => specifier,
		);

		expect(specifiers).not.toEqual(
			expect.arrayContaining([expect.stringMatching(/queries$/)]),
		);
	});
});
