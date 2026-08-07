import { faker } from "@faker-js/faker";
import type { Quality, Read, Sample, SampleMinimal } from "@virtool/contracts";
import { createFakeLabelNested } from "./labels";
import { createFakeSubtractionNested } from "./subtractions";
import { createFakeUserNested } from "./user";

/**
 * Create a fake sample minimal object
 *
 * @param overrides - optional properties for creating a sample minimal with specific values
 */
export function createFakeSampleMinimal(
	overrides?: Partial<SampleMinimal>,
): SampleMinimal {
	const defaultSampleMinimal: SampleMinimal = {
		id: faker.number.int(),
		name: `${faker.word.noun({ strategy: "any-length" })} ${faker.number.int()}`,
		createdAt: faker.date.past(),
		host: faker.word.noun({ strategy: "any-length" }),
		isolate: faker.word.noun({ strategy: "any-length" }),
		job: {
			createdAt: faker.date.past(),
			id: faker.number.int(),
			progress: 100,
			state: "succeeded",
			user: createFakeUserNested(),
			workflow: "create_sample",
		},
		labels: [createFakeLabelNested()],
		libraryType: "normal",
		notes: faker.lorem.lines(5),
		nuvs: faker.datatype.boolean(),
		pathoscope: faker.datatype.boolean(),
		ready: true,
		user: createFakeUserNested(),
		workflows: {
			nuvs: "none",
			pathoscope: "none",
		},
	};

	return { ...defaultSampleMinimal, ...overrides };
}

/**
 * Create a fake sample read object
 */
export function createFakeSampleRead(overrides?: Partial<Read>): Read {
	const defaultRead = {
		downloadUrl: faker.word.noun({ strategy: "any-length" }),
		id: faker.number.int(),
		name: faker.word.noun({ strategy: "any-length" }),
		nameOnDisk: faker.word.noun({ strategy: "any-length" }),
		sample: faker.number.int(),
		size: faker.number.int(),
		storageKey: `samples/${faker.number.int()}/${faker.string.uuid().replaceAll("-", "")}`,
		uploadedAt: faker.date.past(),
	};

	return { ...defaultRead, ...overrides };
}

export function createFakeSampleQuality(): Quality {
	return {
		bases: [Array.from({ length: 6 }, () => faker.number.int())],
		composition: [Array.from({ length: 4 }, () => faker.number.int())],
		count: faker.number.int(),
		encoding: "Sanger / Illumina 1.9",
		gc: faker.number.int(),
		length: [faker.number.int(), faker.number.int()],
		sequences: Array.from({ length: 10 }, () => faker.number.int()),
	};
}

/**
 * Create a fake sample object
 */
export function createFakeSample(overrides?: Partial<Sample>): Sample {
	const defaultSample = {
		...createFakeSampleMinimal(),
		allRead: faker.datatype.boolean(),
		allWrite: faker.datatype.boolean(),
		format: "fastq",
		group: null,
		groupRead: faker.datatype.boolean(),
		groupWrite: faker.datatype.boolean(),
		hold: faker.datatype.boolean(),
		isLegacy: faker.datatype.boolean(),
		locale: faker.location.country(),
		paired: faker.datatype.boolean(),
		quality: createFakeSampleQuality(),
		reads: [createFakeSampleRead()],
		subtractions: [createFakeSubtractionNested()],
	};

	return { ...defaultSample, ...overrides };
}
