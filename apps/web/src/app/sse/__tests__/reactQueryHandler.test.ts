import { accountQueryKeys } from "@account/keys";
import { roleQueryKeys } from "@administration/keys";
import { analysesQueryKeys } from "@analyses/keys";
import { bannerQueryKeys } from "@banner/keys";
import { groupQueryKeys } from "@groups/keys";
import { indexQueryKeys } from "@indexes/keys";
import { jobQueryKeys } from "@jobs/keys";
import { labelQueryKeys } from "@labels/keys";
import { referenceQueryKeys } from "@references/keys";
import { samplesQueryKeys } from "@samples/keys";
import { QueryClient } from "@tanstack/react-query";
import { taskQueryKeys } from "@tasks/keys";
import { fileQueryKeys } from "@uploads/keys";
import { userQueryKeys } from "@users/keys";
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

	describe("selects the narrowest key the domain actually caches under", () => {
		const cases: Array<{
			message: SseMessage;
			queryKey: readonly unknown[];
		}> = [
			// Domains caching both details and lists narrow to one or the other.
			{
				message: { domain: "groups", operation: "update", id: 3 },
				queryKey: groupQueryKeys.detail(3),
			},
			{
				message: { domain: "groups", operation: "insert", id: 3 },
				queryKey: groupQueryKeys.lists(),
			},
			{
				message: { domain: "indexes", operation: "update", id: 8 },
				queryKey: indexQueryKeys.detail(8),
			},
			{
				message: { domain: "indexes", operation: "delete", id: 8 },
				queryKey: indexQueryKeys.lists(),
			},
			{
				message: { domain: "jobs", operation: "insert", id: 42 },
				queryKey: jobQueryKeys.lists(),
			},
			{
				message: { domain: "references", operation: "update", id: 9 },
				queryKey: referenceQueryKeys.detail(9),
			},
			{
				message: { domain: "references", operation: "delete", id: 9 },
				queryKey: referenceQueryKeys.lists(),
			},
			{
				message: { domain: "samples", operation: "update", id: 4184 },
				queryKey: samplesQueryKeys.detail(4184),
			},
			{
				message: { domain: "samples", operation: "insert", id: 4184 },
				queryKey: samplesQueryKeys.lists(),
			},
			{
				message: { domain: "users", operation: "update", id: 7 },
				queryKey: userQueryKeys.detail(7),
			},
			{
				message: { domain: "users", operation: "delete", id: 7 },
				queryKey: userQueryKeys.lists(),
			},

			// Labels and uploads cache lists but no details, so an update narrows
			// to the whole list rather than the whole domain.
			{
				message: { domain: "labels", operation: "update", id: 7 },
				queryKey: labelQueryKeys.lists(),
			},
			{
				message: { domain: "labels", operation: "insert", id: 7 },
				queryKey: labelQueryKeys.lists(),
			},
			{
				message: { domain: "uploads", operation: "update", id: 5 },
				queryKey: fileQueryKeys.lists(),
			},
			{
				message: { domain: "uploads", operation: "insert", id: 5 },
				queryKey: fileQueryKeys.lists(),
			},
			// Analyses cache a detail and a per-sample list, and an update changes
			// the list row (ready), but the frame has no sampleId to target the
			// list — so an update refreshes the whole domain.
			{
				message: { domain: "analyses", operation: "update", id: 5 },
				queryKey: analysesQueryKeys.all(),
			},
			{
				message: { domain: "analyses", operation: "insert", id: 5 },
				queryKey: analysesQueryKeys.lists(),
			},
			// Banners cache the active banner at active(), outside lists(), so an
			// update still has to fall back to the whole domain to reach it.
			{
				message: { domain: "messages", operation: "update", id: 1 },
				queryKey: bannerQueryKeys.all(),
			},
			{
				message: { domain: "messages", operation: "delete", id: 1 },
				queryKey: bannerQueryKeys.lists(),
			},

			// Tasks cache details but no list, so an insert falls back. Their
			// updates skip this mapping entirely — see the batching test below.
			{
				message: { domain: "tasks", operation: "insert", id: 9 },
				queryKey: taskQueryKeys.all(),
			},

			// The account and the role list are cached at all() itself, so every
			// operation falls back to it.
			{
				message: { domain: "account", operation: "update", id: 1 },
				queryKey: accountQueryKeys.all(),
			},
			{
				message: { domain: "account", operation: "insert", id: 1 },
				queryKey: accountQueryKeys.all(),
			},
			{
				message: { domain: "roles", operation: "update", id: "full" },
				queryKey: roleQueryKeys.all(),
			},
			{
				message: { domain: "roles", operation: "insert", id: "full" },
				queryKey: roleQueryKeys.all(),
			},
		];

		for (const { message, queryKey } of cases) {
			it(`${message.domain} on ${message.operation}`, () => {
				reactQueryHandler(queryClient)(message);
				expect(invalidate).toHaveBeenCalledExactlyOnceWith({ queryKey });
			});
		}
	});

	describe("marks what each domain actually caches stale", () => {
		// A key nothing is cached under invalidates nothing, so asserting on the
		// key alone would not catch a domain narrowing to a key it never uses.
		const cases: Array<{ message: SseMessage; queryKey: readonly unknown[] }> =
			[
				{
					message: { domain: "account", operation: "update", id: 1 },
					queryKey: accountQueryKeys.all(),
				},
				{
					message: { domain: "account", operation: "update", id: 1 },
					queryKey: accountQueryKeys.apiKeys(),
				},
				{
					message: { domain: "roles", operation: "update", id: "full" },
					queryKey: roleQueryKeys.all(),
				},
				{
					message: { domain: "labels", operation: "update", id: 7 },
					queryKey: labelQueryKeys.lists(),
				},
				// An analysis flipping to ready must refresh the sample's analyses
				// list row, which renders `ready`, not just the analysis detail.
				{
					message: { domain: "analyses", operation: "update", id: 5 },
					queryKey: analysesQueryKeys.list(["smp1", 1, 25]),
				},
				{
					message: { domain: "messages", operation: "update", id: 1 },
					queryKey: bannerQueryKeys.active(),
				},
				{
					message: { domain: "uploads", operation: "update", id: 5 },
					queryKey: fileQueryKeys.list(["reads", 1, 25]),
				},
				{
					message: { domain: "tasks", operation: "insert", id: 9 },
					queryKey: taskQueryKeys.detail(9),
				},
			];

		for (const { message, queryKey } of cases) {
			it(`${message.domain} on ${message.operation} refreshes ${JSON.stringify(queryKey)}`, () => {
				queryClient.setQueryData(queryKey, {});

				reactQueryHandler(queryClient)(message);

				expect(queryClient.getQueryState(queryKey)?.isInvalidated).toBe(true);
			});
		}
	});

	it("marks every user list variant stale on insert", () => {
		const paginated = userQueryKeys.list([1, 25, ""]);
		const infinite = userQueryKeys.infiniteList([25, ""]);
		const nested = userQueryKeys.nested();

		queryClient.setQueryData(paginated, { documents: [] });
		queryClient.setQueryData(infinite, { pages: [] });
		queryClient.setQueryData(nested, []);

		reactQueryHandler(queryClient)({
			domain: "users",
			operation: "insert",
			id: 7,
		});

		for (const queryKey of [paginated, infinite, nested]) {
			expect(queryClient.getQueryState(queryKey)?.isInvalidated).toBe(true);
		}
	});

	it("marks only the matching user detail stale on update", () => {
		queryClient.setQueryData(userQueryKeys.detail(7), { id: 7 });
		queryClient.setQueryData(userQueryKeys.detail(8), { id: 8 });

		reactQueryHandler(queryClient)({
			domain: "users",
			operation: "update",
			id: 7,
		});

		expect(
			queryClient.getQueryState(userQueryKeys.detail(7))?.isInvalidated,
		).toBe(true);
		expect(
			queryClient.getQueryState(userQueryKeys.detail(8))?.isInvalidated,
		).toBe(false);
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
		expect(invalidate).toHaveBeenCalledExactlyOnceWith({
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
