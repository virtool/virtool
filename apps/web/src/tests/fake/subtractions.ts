import { faker } from "@faker-js/faker";
import type { SubtractionOption } from "@subtraction/types";
import type {
	Subtraction,
	SubtractionFile,
	SubtractionMinimal,
	SubtractionNested,
} from "@virtool/contracts";
import { pick } from "es-toolkit";
import { createFakeUserNested } from "./user";

/**
 * Create a fake subtraction file
 */
export function createFakeSubtractionFile(): SubtractionFile {
	return {
		download_url: faker.internet.url(),
		id: faker.number.int(),
		name: `${faker.word.noun({ strategy: "any-length" })}s.fa`,
		size: faker.number.int({ min: 20000 }),
		storageKey: `subtractions/${faker.number.int()}/${faker.string.uuid().replaceAll("-", "")}`,
		subtraction: faker.number.int(),
		type: "fasta",
	};
}

/**
 * Create a fake subtraction nested
 */
export function createFakeSubtractionNested(
	overrides?: Partial<SubtractionNested>,
): SubtractionNested {
	const defaultSubtractionNested = {
		id: faker.number.int(),
		name: faker.word.noun({ strategy: "any-length" }),
	};

	return { ...defaultSubtractionNested, ...overrides };
}

/**
 * Create a fake minimal subtraction
 */
export function createFakeSubtractionMinimal(
	overrides?: Partial<SubtractionMinimal>,
): SubtractionMinimal {
	const defaultSubtractionMinimal: SubtractionMinimal = {
		...createFakeSubtractionNested(),
		count: faker.number.int({ max: 15 }),
		created_at: faker.date.past().toISOString(),
		file: {
			id: faker.number.int(),
			name: `${faker.word.noun({ strategy: "any-length" })}s.fa`,
		},
		job: null,
		nickname: faker.word.noun({ strategy: "any-length" }),
		ready: true,
		user: createFakeUserNested(),
	};

	return { ...defaultSubtractionMinimal, ...overrides };
}

/**
 * Create a fake subtraction
 */
export function createFakeSubtraction(
	overrides?: Partial<Subtraction>,
): Subtraction {
	const { files, gc, linked_samples, ...props } = overrides || {};
	return {
		...createFakeSubtractionMinimal(props),
		files: files || [createFakeSubtractionFile()],
		gc: gc || { a: 1, c: 1, g: 1, n: 1, t: 1 },
		linked_samples: linked_samples || [],
	};
}

/**
 * Create a fake subtraction shortlist
 */
export function createFakeShortlistSubtraction(): SubtractionOption {
	return pick(createFakeSubtractionMinimal(), ["id", "name", "ready"]);
}
