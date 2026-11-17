import {
	sortAndFilterNuvsHits,
	sortAndFilterPathoscopeHits,
} from "@analyses/hits";
import { type AnalysisSearch, DEFAULT_ANALYSIS_SEARCH } from "@analyses/search";
import type { FormattedNuvsHit } from "@analyses/types";
import { createFakePathoscopeHit } from "@tests/fake/analyses";
import { describe, expect, it } from "vitest";

// Three hits whose name, coverage, depth and weight each rank them differently,
// so a sort that reads the wrong field cannot accidentally produce the right
// order. Only one name is capitalised out of alphabetical order, so a raw
// codepoint comparison ranks them differently again.
const pathoscopeHits = [
	createFakePathoscopeHit({
		id: "a",
		name: "adenovirus",
		coverage: 0.1,
		depth: 30,
		pi: 0.5,
	}),
	createFakePathoscopeHit({
		id: "b",
		name: "Betaflexivirus",
		coverage: 0.9,
		depth: 10,
		pi: 0.2,
	}),
	createFakePathoscopeHit({
		id: "c",
		name: "Cucumovirus",
		coverage: 0.5,
		depth: 20,
		pi: 0.9,
	}),
];

function sortPathoscope(search: Partial<AnalysisSearch>) {
	return sortAndFilterPathoscopeHits(pathoscopeHits, {
		...DEFAULT_ANALYSIS_SEARCH,
		...search,
	}).map((hit) => hit.id);
}

describe("sortAndFilterPathoscopeHits()", () => {
	it.each<[string, Partial<AnalysisSearch>, string[]]>([
		// The toolbar labels `pi` "Weight" and puts that word in the URL.
		["weight ascending", { sort: "weight", dir: "asc" }, ["b", "a", "c"]],
		["weight descending", { sort: "weight", dir: "desc" }, ["c", "a", "b"]],
		["coverage ascending", { sort: "coverage", dir: "asc" }, ["a", "c", "b"]],
		["depth ascending", { sort: "depth", dir: "asc" }, ["b", "c", "a"]],
		// A raw codepoint comparison would give ["b", "c", "a"] ascending.
		[
			"name ascending, ignoring case",
			{ sort: "name", dir: "asc" },
			["a", "b", "c"],
		],
		[
			"name descending, ignoring case",
			{ sort: "name", dir: "desc" },
			["c", "b", "a"],
		],
		// A freshly-opened analysis leads with its strongest hits.
		["coverage descending by default", {}, ["b", "c", "a"]],
		// Only "a", at 0.1 coverage, is under the 0.5 default.
		["the coverage cutoff when filtering", { showLowOtus: false }, ["b", "c"]],
		["a search by name", { find: "Cucumo" }, ["c"]],
	])("should apply %s", (_, search, expected) => {
		expect(sortPathoscope(search)).toEqual(expected);
	});
});

function createNuvsHit(overrides: Partial<FormattedNuvsHit>): FormattedNuvsHit {
	return {
		annotatedOrfCount: 0,
		blast: null,
		e: null,
		families: [],
		id: 0,
		index: 0,
		names: [],
		orfs: [],
		sequence: "ATGC",
		...overrides,
	};
}

// The server derives `names`, `families` and `e` from the contig's ORF hits,
// so these are the shaped values the function is handed. Each contig has its
// own length, so the default length sort gives one order.
const nuvsHits = [
	createNuvsHit({
		id: 1,
		annotatedOrfCount: 1,
		e: 0.5,
		sequence: "ATGCAT",
		families: ["Alphaflexiviridae"],
		names: ["Capsid protein"],
	}),
	createNuvsHit({
		id: 2,
		annotatedOrfCount: 3,
		e: 0,
		families: ["Rhabdoviridae"],
		names: ["Replicase"],
	}),
	createNuvsHit({
		id: 3,
		annotatedOrfCount: 2,
		e: null,
		sequence: "AT",
		families: [],
		names: [],
	}),
];

// A contig's length is the length of its own sequence. A hit carries no
// `length` field.
const byLength = [
	createNuvsHit({ id: 1, e: 0.5, sequence: "AT" }),
	createNuvsHit({ id: 2, e: 0.5, sequence: "ATGCAT" }),
	createNuvsHit({ id: 3, e: 0.5, sequence: "ATGC" }),
];

describe("sortAndFilterNuvsHits()", () => {
	it.each<[string, Partial<AnalysisSearch>, FormattedNuvsHit[], number[]]>([
		["search the annotation names", { find: "Replicase" }, nuvsHits, [2]],
		["trim the search term", { find: "  Replicase  " }, nuvsHits, [2]],
		["search families", { find: "Alphaflexiviridae" }, nuvsHits, [1]],
		// An e-value of zero is the strongest hit, so a filter that tests for
		// truthiness rather than for null would drop the best contig.
		["hide only contigs with no e-value", {}, nuvsHits, [1, 2]],
		[
			"treat a whitespace-only search as empty",
			{ find: "   " },
			nuvsHits,
			[1, 2],
		],
		[
			"keep unannotated contigs when not filtering",
			{ showUnhitSequences: true },
			nuvsHits,
			[1, 2, 3],
		],
		["sort by e-value, lowest first", { sort: "e" }, nuvsHits, [2, 1]],
		[
			"rank a contig with no e-value last",
			{ showUnhitSequences: true, sort: "e" },
			nuvsHits,
			[2, 1, 3],
		],
		[
			"sort by annotated ORF count, highest first",
			{ showUnhitSequences: true, sort: "orfs" },
			nuvsHits,
			[2, 3, 1],
		],
		["sort by length, longest first", { sort: "length" }, byLength, [2, 3, 1]],
		["sort by length by default", {}, byLength, [2, 3, 1]],
	])("should %s", (_, search, hits, expected) => {
		expect(
			sortAndFilterNuvsHits(hits, {
				...DEFAULT_ANALYSIS_SEARCH,
				...search,
			}).map((hit) => hit.id),
		).toEqual(expected);
	});
});
