import { accountQueryKeys } from "@account/keys";
import { roleQueryKeys } from "@administration/keys";
import { analysesQueryKeys } from "@analyses/keys";
import type { QueryKeys } from "@app/queryKeys";
import { bannerQueryKeys } from "@banner/keys";
import { groupQueryKeys } from "@groups/keys";
import { indexQueryKeys } from "@indexes/keys";
import { jobQueryKeys } from "@jobs/keys";
import { labelQueryKeys } from "@labels/keys";
import { otuQueryKeys } from "@otus/keys";
import { referenceQueryKeys } from "@references/keys";
import { samplesQueryKeys } from "@samples/keys";
import { subtractionQueryKeys } from "@subtraction/keys";
import {
	hashKey,
	type QueryClient,
	type QueryKey,
} from "@tanstack/react-query";
import { taskQueryKeys } from "@tasks/keys";
import { fileQueryKeys } from "@uploads/keys";
import { userQueryKeys } from "@users/keys";
import type { SseDomain, SseMessage } from "@virtool/contracts";

/** A change to one record, as a mutation or a server-push frame reports it. */
export type Change = SseMessage;

/**
 * How a domain caches its records.
 *
 * `records` domains cache each record at `detail(id)` and collections under
 * `lists()`. `whole` domains cache something outside those two keys, such as a
 * singleton at `all()` or the active banner, so every change refreshes `all()`.
 */
type DomainCache = {
	keys: QueryKeys;
	shape: "records" | "whole";
};

const domains: Record<SseDomain, DomainCache> = {
	account: { keys: accountQueryKeys, shape: "whole" },
	analyses: { keys: analysesQueryKeys, shape: "records" },
	banners: { keys: bannerQueryKeys, shape: "whole" },
	groups: { keys: groupQueryKeys, shape: "records" },
	indexes: { keys: indexQueryKeys, shape: "records" },
	jobs: { keys: jobQueryKeys, shape: "records" },
	labels: { keys: labelQueryKeys, shape: "records" },
	otus: { keys: otuQueryKeys, shape: "records" },
	references: { keys: referenceQueryKeys, shape: "records" },
	roles: { keys: roleQueryKeys, shape: "whole" },
	samples: { keys: samplesQueryKeys, shape: "records" },
	subtractions: { keys: subtractionQueryKeys, shape: "records" },
	tasks: { keys: taskQueryKeys, shape: "whole" },
	uploads: { keys: fileQueryKeys, shape: "records" },
	users: { keys: userQueryKeys, shape: "records" },
};

/** Domains whose records embed a user's handle. */
const userEmbedders: QueryKey[] = [
	accountQueryKeys.all(),
	analysesQueryKeys.all(),
	fileQueryKeys.all(),
	groupQueryKeys.all(),
	indexQueryKeys.all(),
	jobQueryKeys.all(),
	referenceQueryKeys.all(),
	samplesQueryKeys.all(),
	subtractionQueryKeys.all(),
];

function getOwnKeys(domain: DomainCache, change: Change): QueryKey[] {
	if (domain.shape === "whole") {
		return [domain.keys.all()];
	}

	if (change.operation === "insert") {
		return [domain.keys.lists()];
	}

	return [domain.keys.detail(change.id), domain.keys.lists()];
}

/**
 * Keys in other domains whose cached data the change alters.
 *
 * Most are records that embed the changed one, such as a sample's labels or an
 * analysis's reference name. The rest are derived values: a label's sample
 * count, a reference's OTU count, the changes a reference's next index build
 * would include, and the read files a sample holds until it is deleted.
 */
function getDependentKeys(change: Change): QueryKey[] {
	const created = change.operation === "insert";

	switch (change.domain) {
		case "analyses":
			return created || change.operation === "delete"
				? [samplesQueryKeys.all()]
				: [];
		case "groups":
			return created
				? []
				: [
						accountQueryKeys.all(),
						referenceQueryKeys.all(),
						samplesQueryKeys.all(),
						userQueryKeys.all(),
					];
		case "indexes":
			return [indexQueryKeys.allUnbuilt(), referenceQueryKeys.all()];
		case "labels":
			return created ? [] : [samplesQueryKeys.all()];
		case "otus":
			return [indexQueryKeys.allUnbuilt(), referenceQueryKeys.all()];
		case "references":
			return created
				? []
				: [
						analysesQueryKeys.all(),
						indexQueryKeys.all(),
						otuQueryKeys.list([change.id]),
					];
		case "samples":
			return [
				labelQueryKeys.lists(),
				...(created ? [] : [analysesQueryKeys.all()]),
				...(change.operation === "update" ? [] : [fileQueryKeys.lists()]),
			];
		case "subtractions":
			return created ? [] : [analysesQueryKeys.all(), samplesQueryKeys.all()];
		case "users":
			return created ? [groupQueryKeys.all()] : userEmbedders;
		default:
			return [];
	}
}

/**
 * Get every query key a change must refresh.
 *
 * A created record reaches its domain's lists. An updated or deleted record
 * reaches its detail and its domain's lists. Each change also reaches the keys
 * of other domains that show the record or a value derived from it.
 */
function getChangeKeys(change: Change): QueryKey[] {
	return [
		...getOwnKeys(domains[change.domain], change),
		...getDependentKeys(change),
	];
}

/** Refresh every cached query that shows the changed record. */
export function invalidateChange(
	queryClient: QueryClient,
	change: Change,
): Promise<void> {
	return invalidateChanges(queryClient, [change]);
}

/**
 * Refresh every cached query that shows any of the changed records.
 *
 * A key that several changes share, such as a domain's `lists()`, is
 * invalidated once, so a batch of changes does not refetch it once per record.
 */
export async function invalidateChanges(
	queryClient: QueryClient,
	changes: Change[],
): Promise<void> {
	const queryKeys = new Map<string, QueryKey>();

	for (const change of changes) {
		for (const queryKey of getChangeKeys(change)) {
			queryKeys.set(hashKey(queryKey), queryKey);
		}
	}

	await Promise.all(
		[...queryKeys.values()].map((queryKey) =>
			queryClient.invalidateQueries({ queryKey }),
		),
	);
}

/** Check whether a domain name belongs to a domain the client caches. */
export function isCachedDomain(domain: string): domain is SseDomain {
	return Object.hasOwn(domains, domain);
}
