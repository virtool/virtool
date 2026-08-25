import {
	buildMappingIndexCacheParams,
	deriveCacheKey,
} from "@virtool/workflow";
import { describe, expect, it } from "vitest";
import {
	buildCollapsedReferenceCacheParams,
	buildReferenceIndexExtraParams,
	WORKFLOW_NAME,
} from "./cacheParams";

/**
 * The keys these namespaces are pinned to: the SHA-256 of the params rendered
 * as JSON with keys sorted, no whitespace around the separators, and every
 * non-ASCII character escaped. `oldReference` is the default-isolate artifact
 * key that the representative policy must never reuse.
 *
 * `collapsed` is the key the shared `collapsed_reference` namespace uses. It is
 * pinned as the key this workflow's forked params must **not** derive.
 *
 * **Never edit one to match this implementation's output.** A mismatch means
 * the same inputs now derive a different key, and the failure mode is silent —
 * every lookup misses and a second copy is written under a key nothing else
 * asks for.
 */
const PINNED_KEYS = {
	reference: "5155d708b76b8f17b701fd46dd79163070794849b90c439b4e0d91fa306c9d96",
	oldReference:
		"da4654a3a9c96981cc6a071c99d2a0caf03012b9d0b98931963e3601173af66e",
	subtraction:
		"77cc01d7028d9d87fadc9d091a590577359ceedcb1a5a8a1d95911f46f7b9aea",
	collapsed: "3d4bbf0d92c5e39a0f72f394cc2c40eb6cb2add959e3491e9b8d922d43a9b5ec",
};

const TOOL_VERSION = "2.5.4";
const CD_HIT_EST_VERSION = "4.8.1";
const WORKFLOW_VERSION = "5.2.1";

// The params themselves are the runtime's — every workflow that builds a bowtie2
// index derives them the same way. What is pinned here is that *this* workflow's
// inputs to them land on the key its indexes are already archived under, which
// is what lets a run reuse a blob instead of rebuilding it.
describe("the shared mapping index namespaces", () => {
	it("derives the pinned key for a reference mapping index", () => {
		const params = buildMappingIndexCacheParams({
			extra: buildReferenceIndexExtraParams(CD_HIT_EST_VERSION),
			indexKind: "reference_mapping_index",
			parentId: 42,
			toolVersion: TOOL_VERSION,
			workflow: WORKFLOW_NAME,
			workflowVersion: WORKFLOW_VERSION,
		});

		expect(deriveCacheKey(params)).toBe(PINNED_KEYS.reference);
		expect(deriveCacheKey(params)).not.toBe(PINNED_KEYS.oldReference);
		expect(params).toMatchObject({
			selection: "cd_hit_est_representatives",
			selection_coverage: "none",
			selection_identity: "0.80",
			selection_minimum_length: "9",
			selection_policy_version: "otu-segment-v1",
			selection_source: "full_source_reference",
			selection_tool: "cd-hit-est",
			selection_tool_version: CD_HIT_EST_VERSION,
			selection_word_size: "5",
		});
	});

	it("derives the pinned key for a subtraction mapping index", () => {
		const params = buildMappingIndexCacheParams({
			indexKind: "subtraction_mapping_index",
			parentId: 7,
			toolVersion: TOOL_VERSION,
			workflow: WORKFLOW_NAME,
			workflowVersion: WORKFLOW_VERSION,
		});

		expect(deriveCacheKey(params)).toBe(PINNED_KEYS.subtraction);
	});
});

describe("buildCollapsedReferenceCacheParams", () => {
	// FORKED from the shared namespace, deliberately: the artifact is a SQLite
	// index this code writes, and one this code did not write is not
	// interchangeable with it.
	it("differs from the shared namespace's key for the same inputs", () => {
		const params = buildCollapsedReferenceCacheParams({
			indexId: 42,
			toolVersion: "4.8.1",
			workflowVersion: WORKFLOW_VERSION,
		});

		expect(deriveCacheKey(params)).not.toBe(PINNED_KEYS.collapsed);
	});

	it("carries a discriminator the shared namespace's params do not", () => {
		const params = buildCollapsedReferenceCacheParams({
			indexId: 42,
			toolVersion: "4.8.1",
			workflowVersion: WORKFLOW_VERSION,
		});

		const { impl, ...withoutDiscriminator } = params;

		expect(impl).toBe("typescript-v2");
		// Removing it lands back on the shared namespace's key, which is what makes
		// the fork the discriminator's doing rather than an accident of some other
		// field.
		expect(deriveCacheKey(withoutDiscriminator)).toBe(PINNED_KEYS.collapsed);
		expect(deriveCacheKey(params)).not.toBe(
			deriveCacheKey({ ...params, impl: "typescript-v1" }),
		);
	});
});
