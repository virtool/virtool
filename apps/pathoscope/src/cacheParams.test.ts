import {
	buildMappingIndexCacheParams,
	deriveCacheKey,
	type RunSubprocess,
} from "@virtool/workflow";
import { describe, expect, it, vi } from "vitest";
import {
	buildCollapsedReferenceCacheParams,
	getCdHitEstVersion,
	REFERENCE_INDEX_EXTRA_PARAMS,
	WORKFLOW_NAME,
} from "./cacheParams";

/**
 * The keys these namespaces are pinned to, recorded from blobs already in the
 * bucket rather than reasoned out from the serialization: the SHA-256 of the
 * params rendered as JSON with keys sorted, no whitespace around the
 * separators, and every non-ASCII character escaped.
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
	reference: "da4654a3a9c96981cc6a071c99d2a0caf03012b9d0b98931963e3601173af66e",
	subtraction:
		"77cc01d7028d9d87fadc9d091a590577359ceedcb1a5a8a1d95911f46f7b9aea",
	collapsed: "3d4bbf0d92c5e39a0f72f394cc2c40eb6cb2add959e3491e9b8d922d43a9b5ec",
};

const TOOL_VERSION = "2.5.4";
const WORKFLOW_VERSION = "5.2.1";

function subprocessWriting(
	lines: readonly string[],
	{
		stream = "stdout",
		fails = false,
	}: { stream?: "stdout" | "stderr"; fails?: boolean } = {},
): RunSubprocess {
	return vi.fn(async (options) => {
		for (const line of lines) {
			await options[stream]?.(line);
		}

		if (fails) {
			throw new Error("subprocess exited 1");
		}

		return {
			command: options.command,
			exitCode: 0,
			signal: null,
			cancelled: false,
			stderrTail: [],
			durationMs: 1,
		};
	});
}

// The params themselves are the runtime's — every workflow that builds a bowtie2
// index derives them the same way. What is pinned here is that *this* workflow's
// inputs to them land on the key its indexes are already archived under, which
// is what lets a run reuse a blob instead of rebuilding it.
describe("the shared mapping index namespaces", () => {
	it("derives the pinned key for a reference mapping index", () => {
		const params = buildMappingIndexCacheParams({
			extra: REFERENCE_INDEX_EXTRA_PARAMS,
			indexKind: "reference_mapping_index",
			parentId: 42,
			toolVersion: TOOL_VERSION,
			workflow: WORKFLOW_NAME,
			workflowVersion: WORKFLOW_VERSION,
		});

		expect(deriveCacheKey(params)).toBe(PINNED_KEYS.reference);
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

		expect(impl).toBeDefined();
		// Removing it lands back on the shared namespace's key, which is what makes
		// the fork the discriminator's doing rather than an accident of some other
		// field.
		expect(deriveCacheKey(withoutDiscriminator)).toBe(PINNED_KEYS.collapsed);
	});
});

describe("getCdHitEstVersion", () => {
	// `cd-hit-est -h` prints its help text and exits 1. There is no --version
	// flag, so the failure is expected and the output is parsed anyway.
	it("parses the version out of a run that exits non-zero", async () => {
		const runSubprocess = subprocessWriting(
			["\t\t====== CD-HIT version 4.8.1 (built on Jan 1 2024) ======", ""],
			{ fails: true },
		);

		await expect(getCdHitEstVersion(runSubprocess)).resolves.toBe("4.8.1");
	});

	it("reads the banner from stderr as well as stdout", async () => {
		const runSubprocess = subprocessWriting(
			["====== CD-HIT version 4.8.1 ======"],
			{ stream: "stderr", fails: true },
		);

		await expect(getCdHitEstVersion(runSubprocess)).resolves.toBe("4.8.1");
	});

	// A missing binary produces no matching line, and the failure names the
	// version parse rather than the exit code.
	it("throws when the output carries no version", async () => {
		await expect(
			getCdHitEstVersion(subprocessWriting([], { fails: true })),
		).rejects.toThrow("Could not parse cd-hit-est version");
	});
});
