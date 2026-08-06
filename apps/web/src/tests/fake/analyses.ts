import type { Blast, FormattedNuvsAnalysis } from "@analyses/types";
import { faker } from "@faker-js/faker";
import type { AnalysisMinimal, PathoscopeHit } from "@virtool/contracts";
import { createFakeSubtractionNested } from "./subtractions";
import { createFakeUserNested } from "./user";

/**
 * Create a fake analysis minimal object
 *
 * @param overrides - optional properties for creating an analysis minimal with specific values
 */
export function createFakeAnalysisMinimal(
	overrides?: Partial<AnalysisMinimal>,
): AnalysisMinimal {
	return {
		id: faker.number.int(),
		createdAt: faker.date.past().toISOString(),
		index: {
			id: faker.number.int(),
			version: faker.number.int({ min: 1, max: 20 }),
		},
		job: {
			createdAt: faker.date.past().toISOString(),
			id: faker.number.int(),
			progress: 100,
			state: "succeeded",
			user: createFakeUserNested(),
			workflow: "pathoscope",
		},
		ready: true,
		reference: { id: faker.number.int(), name: faker.lorem.words(2) },
		sample: {
			id: faker.number.int(),
			name: faker.lorem.words(2),
		},
		subtractions: [createFakeSubtractionNested()],
		updatedAt: faker.date.past().toISOString(),
		user: createFakeUserNested(),
		workflow: "pathoscope",
		...overrides,
	};
}

/**
 * Create a fake formatted nuvs analysis object
 *
 * @param overrides - optional properties for creating an fake formatted nuvs analysis with specific values
 */
export function createFakeFormattedNuVsAnalysis(
	overrides?: Partial<FormattedNuvsAnalysis>,
): FormattedNuvsAnalysis {
	const defaultAnalysis: FormattedNuvsAnalysis = {
		...createFakeAnalysisMinimal(),
		files: [],
		results: {
			hits: [createFakeFormattedNuVsHit()],
			maxSequenceLength: faker.number.int({ min: 800, max: 20000 }),
		},
		workflow: "nuvs",
	};

	return { ...defaultAnalysis, ...overrides };
}

type FakeFormattedNuVsHit = {
	blast?: Blast;
	index?: number;
};

/**
 * Create a fake pathoscope hit object
 *
 * Its defaults are fixed rather than faked: the export tests assert the exact
 * TSV a hit renders to, and every column of that string comes from a default
 * left unoverridden.
 *
 * @param overrides - optional properties for creating a pathoscope hit with specific values
 */
export function createFakePathoscopeHit(
	overrides?: Partial<PathoscopeHit>,
): PathoscopeHit {
	return {
		abbreviation: "TMV",
		coverage: 0.5,
		depth: 12,
		id: "hit",
		isolates: [],
		length: 6000,
		maxDepth: 20,
		name: "Tobacco mosaic virus",
		pi: 0.25,
		segments: [],
		version: 3,
		...overrides,
	};
}

/**
 * Create a fake nuvs hit object
 *
 * @param overrides - optional properties for creating an nuvs hit with specific values
 */
export function createFakeFormattedNuVsHit(overrides?: FakeFormattedNuVsHit) {
	const nuvsHit = {
		annotatedOrfCount: faker.number.int(),
		blast: null,
		e: faker.number.float({ min: 1e-23, max: 0.001 }),
		families: [],
		id: faker.number.int(),
		index: faker.number.int(),
		names: [faker.word.noun({ strategy: "any-length" })],
		orfs: [
			{
				frame: faker.number.int(),
				hits: [
					{
						best_bias: faker.number.float(),
						best_e: faker.number.float(),
						best_score: faker.number.float(),
						cluster: faker.number.int(),
						families: {},
						full_bias: faker.number.float(),
						full_e: faker.number.float(),
						full_score: faker.number.float(),
						hit: faker.number.int({ min: 1 }),
						names: [faker.word.noun({ strategy: "any-length" })],
					},
				],
				index: faker.number.int(),
				pos: [faker.number.int(), faker.number.int()],
				pro: faker.word.noun({ strategy: "any-length" }),
				strand: faker.number.int({ min: 1, max: 2 }),
			},
		],
		sequence: faker.string.fromCharacters("ATGC", { min: 20, max: 150 }),
	};

	return { ...nuvsHit, ...overrides };
}
