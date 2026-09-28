import { accountQueryKeys } from "@account/keys";
import { roleQueryKeys } from "@administration/keys";
import { analysesQueryKeys } from "@analyses/keys";
import { bannerQueryKeys } from "@banner/keys";
import { groupQueryKeys } from "@groups/keys";
import { indexQueryKeys } from "@indexes/keys";
import { jobQueryKeys } from "@jobs/keys";
import { labelQueryKeys } from "@labels/keys";
import { otuQueryKeys } from "@otus/keys";
import { referenceQueryKeys } from "@references/keys";
import { samplesQueryKeys } from "@samples/keys";
import { subtractionQueryKeys } from "@subtraction/keys";
import { QueryClient, type QueryKey } from "@tanstack/react-query";
import { taskQueryKeys } from "@tasks/keys";
import { fileQueryKeys } from "@uploads/keys";
import { userQueryKeys } from "@users/keys";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	type Change,
	invalidateChange,
	invalidateChanges,
} from "../invalidate";
import invalidateSource from "../invalidate.ts?raw";

describe("invalidateChange", () => {
	let queryClient: QueryClient;

	beforeEach(() => {
		queryClient = new QueryClient();
	});

	function isInvalidated(queryKey: QueryKey): boolean | undefined {
		return queryClient.getQueryState(queryKey)?.isInvalidated;
	}

	async function check(
		change: Change,
		stale: QueryKey[],
		fresh: QueryKey[] = [],
	) {
		for (const queryKey of [...stale, ...fresh]) {
			queryClient.setQueryData(queryKey, {});
		}

		await invalidateChange(queryClient, change);

		for (const queryKey of stale) {
			expect(isInvalidated(queryKey), JSON.stringify(queryKey)).toBe(true);
		}

		for (const queryKey of fresh) {
			expect(isInvalidated(queryKey), JSON.stringify(queryKey)).toBe(false);
		}
	}

	describe("refreshes the changed domain's own queries", () => {
		it("refreshes lists but no detail on insert", async () => {
			await check(
				{ domain: "samples", operation: "insert", id: 4 },
				[
					samplesQueryKeys.list([1, 25]),
					samplesQueryKeys.list(["recentlyViewed", 5]),
				],
				[samplesQueryKeys.detail(3)],
			);
		});

		it("refreshes the detail and every list on update", async () => {
			await check(
				{ domain: "subtractions", operation: "update", id: 4 },
				[
					subtractionQueryKeys.detail(4),
					subtractionQueryKeys.list([1, 25, ""]),
					subtractionQueryKeys.shortlist(),
				],
				[subtractionQueryKeys.detail(5)],
			);
		});

		it("refreshes the detail and every list on delete", async () => {
			await check(
				{ domain: "references", operation: "delete", id: 9 },
				[referenceQueryKeys.detail(9), referenceQueryKeys.list([1, 25])],
				[referenceQueryKeys.detail(8)],
			);
		});

		it("refreshes what nests under the detail", async () => {
			await check({ domain: "analyses", operation: "update", id: 5 }, [
				analysesQueryKeys.results(5),
				analysesQueryKeys.list([1, 1, 25]),
				analysesQueryKeys.users([1, ["pathoscope"]]),
			]);
		});

		it("refreshes an OTU's detail, history, and reference list", async () => {
			await check(
				{ domain: "otus", operation: "update", id: "abc" },
				[
					otuQueryKeys.detail("abc"),
					otuQueryKeys.history("abc"),
					otuQueryKeys.list([9, 1, 25, ""]),
				],
				[otuQueryKeys.detail("def")],
			);
		});

		// These domains cache something outside `detail(id)` and `lists()`.
		const whole: Array<{ change: Change; queryKey: QueryKey }> = [
			{
				change: { domain: "account", operation: "update", id: 1 },
				queryKey: accountQueryKeys.apiKeys(),
			},
			{
				change: { domain: "banners", operation: "update", id: 1 },
				queryKey: bannerQueryKeys.active(),
			},
			{
				change: { domain: "roles", operation: "update", id: "full" },
				queryKey: roleQueryKeys.all(),
			},
			{
				change: { domain: "tasks", operation: "insert", id: 9 },
				queryKey: taskQueryKeys.detail(9),
			},
		];

		for (const { change, queryKey } of whole) {
			it(`refreshes all of ${change.domain} on ${change.operation}`, async () => {
				await check(change, [queryKey]);
			});
		}
	});

	describe("refreshes other domains that show the change", () => {
		const cases: Array<{
			change: Change;
			stale: QueryKey[];
			fresh?: QueryKey[];
		}> = [
			{
				change: { domain: "labels", operation: "update", id: 7 },
				stale: [samplesQueryKeys.list([1, 25]), samplesQueryKeys.detail(4)],
			},
			{
				change: { domain: "labels", operation: "insert", id: 7 },
				stale: [labelQueryKeys.lists()],
				fresh: [samplesQueryKeys.detail(4)],
			},
			{
				change: { domain: "samples", operation: "update", id: 4 },
				stale: [labelQueryKeys.lists(), analysesQueryKeys.detail(5)],
				fresh: [fileQueryKeys.list(["reads", 1, 25])],
			},
			{
				change: { domain: "samples", operation: "insert", id: 4 },
				stale: [labelQueryKeys.lists(), fileQueryKeys.infiniteList(["reads"])],
			},
			{
				change: { domain: "samples", operation: "delete", id: 4 },
				stale: [labelQueryKeys.lists(), fileQueryKeys.list(["reads", 1, 25])],
			},
			{
				change: { domain: "analyses", operation: "insert", id: 5 },
				stale: [samplesQueryKeys.list([1, 25]), samplesQueryKeys.detail(4)],
			},
			{
				change: { domain: "subtractions", operation: "update", id: 3 },
				stale: [samplesQueryKeys.detail(4), analysesQueryKeys.detail(5)],
			},
			{
				change: { domain: "references", operation: "update", id: 9 },
				stale: [
					analysesQueryKeys.detail(5),
					indexQueryKeys.list([9, 1, 25]),
					otuQueryKeys.list([9, 1, 25, ""]),
				],
				fresh: [otuQueryKeys.list([8, 1, 25, ""])],
			},
			{
				change: { domain: "otus", operation: "delete", id: "abc" },
				stale: [referenceQueryKeys.detail(9), indexQueryKeys.unbuilt(9)],
				fresh: [indexQueryKeys.detail(2)],
			},
			{
				change: { domain: "indexes", operation: "insert", id: 2 },
				stale: [indexQueryKeys.unbuilt(9), referenceQueryKeys.detail(9)],
			},
			{
				change: { domain: "groups", operation: "update", id: 3 },
				stale: [
					accountQueryKeys.all(),
					userQueryKeys.detail(7),
					samplesQueryKeys.detail(4),
					referenceQueryKeys.detail(9),
				],
			},
			{
				change: { domain: "users", operation: "insert", id: 7 },
				stale: [groupQueryKeys.detail(3)],
				fresh: [samplesQueryKeys.detail(4)],
			},
			{
				change: { domain: "users", operation: "update", id: 7 },
				stale: [
					accountQueryKeys.all(),
					analysesQueryKeys.list([1, 1, 25]),
					fileQueryKeys.list(["reads", 1, 25]),
					groupQueryKeys.detail(3),
					indexQueryKeys.detail(2),
					jobQueryKeys.list([1, 25]),
					referenceQueryKeys.detail(9),
					samplesQueryKeys.detail(4),
					subtractionQueryKeys.shortlist(),
				],
				fresh: [userQueryKeys.detail(8)],
			},
		];

		for (const { change, stale, fresh } of cases) {
			it(`${change.domain} on ${change.operation}`, async () => {
				await check(change, stale, fresh);
			});
		}
	});

	it("invalidates a key shared by a batch of changes once", async () => {
		const invalidate = vi.spyOn(queryClient, "invalidateQueries");

		await invalidateChanges(queryClient, [
			{ domain: "uploads", operation: "delete", id: 1 },
			{ domain: "uploads", operation: "delete", id: 2 },
		]);

		expect(invalidate.mock.calls.map(([filters]) => filters?.queryKey)).toEqual(
			[fileQueryKeys.detail(1), fileQueryKeys.lists(), fileQueryKeys.detail(2)],
		);
	});

	// Every mutation hook and the SSE handler load this module. Importing a
	// feature's `queries` module for a key would drag its request layer into
	// all of them.
	it("imports keys only, never a feature's queries module", () => {
		const specifiers = [...invalidateSource.matchAll(/from\s+"([^"]+)"/g)].map(
			([, specifier]) => specifier,
		);

		expect(specifiers).not.toEqual(
			expect.arrayContaining([expect.stringMatching(/queries$/)]),
		);
	});
});
