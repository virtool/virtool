import { faker } from "@faker-js/faker";
import type {
	Index,
	IndexFile,
	IndexMinimal,
	IndexNested,
} from "@virtool/contracts";
import { createFakeUserNested } from "./user";

export function createFakeIndexNested(
	overrides?: Partial<IndexNested>,
): IndexNested {
	const defaultIndexNested = {
		id: faker.number.int(),
		version: faker.number.int({ max: 10 }),
	};

	return { ...defaultIndexNested, ...overrides };
}

export function createFakeIndexMinimal(
	overrides?: Partial<IndexMinimal>,
): IndexMinimal {
	const defaultIndexMinimal = {
		...createFakeIndexNested(),
		changeCount: faker.number.int({ min: 2, max: 10 }),
		createdAt: faker.date.past(),
		modifiedOtuCount: faker.number.int({ min: 2, max: 10 }),
		reference: {
			id: faker.number.int(),
			name: faker.word.noun({ strategy: "any-length" }),
		},
		user: createFakeUserNested(),
		ready: faker.datatype.boolean(),
	};

	return { ...defaultIndexMinimal, ...overrides };
}

export function createFakeIndex(overrides?: Partial<Index>): Index {
	const defaultIndex = {
		...createFakeIndexMinimal(),
		contributors: [
			{
				...createFakeUserNested(),
				count: faker.number.int({ min: 1, max: 10 }),
			},
		],
		files: [createFakeIndexFile()],
		manifest: {},
		otus: [
			{
				changeCount: faker.number.int({ min: 1, max: 10 }),
				id: faker.string.alphanumeric({ casing: "lower", length: 8 }),
				name: faker.word.noun({ strategy: "any-length" }),
			},
		],
	};

	return { ...defaultIndex, ...overrides };
}

export function createFakeIndexFile(overrides?: Partial<IndexFile>): IndexFile {
	const defaultIndexFile = {
		downloadUrl: `/testUrl/${faker.word.noun({ strategy: "any-length" })}`,
		id: faker.number.int(),
		index: faker.number.int(),
		name: faker.word.noun({ strategy: "any-length" }),
		size: faker.number.int({ min: 20000 }),
		storageKey: `indexes/${faker.number.int()}/${faker.string.uuid().replaceAll("-", "")}`,
		type: "fasta",
	};

	return { ...defaultIndexFile, ...overrides };
}
