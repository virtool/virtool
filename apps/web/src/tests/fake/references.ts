import { faker } from "@faker-js/faker";
import type { Reference, ReferenceMinimal } from "@virtool/contracts";
import { createFakeUserNested } from "./user";

/**
 * Create a fake reference minimal
 */
export function createFakeReferenceMinimal(
	overrides?: Partial<ReferenceMinimal>,
): ReferenceMinimal {
	const base: ReferenceMinimal = {
		id: faker.number.int(),
		dataType: "genome",
		name: faker.word.noun({ strategy: "any-length" }),
		archived: false,
		clonedFrom: {
			id: faker.number.int(),
			name: faker.word.noun({ strategy: "any-length" }),
		},
		createdAt: faker.date.past(),
		importedFrom: null,
		latestBuild: null,
		organism: faker.word.noun({ strategy: "any-length" }),
		otuCount: faker.number.int(),
		task: {
			complete: true,
			createdAt: faker.date.past(),
			error: null,
			id: faker.number.int(),
			progress: 100,
			step: "clone_reference",
			type: "clone_reference",
		},
		user: createFakeUserNested(),
	};

	return { ...base, ...overrides };
}

/**
 * Create a fake reference
 */
export function createFakeReference(overrides?: Partial<Reference>): Reference {
	const { description, ...props } = overrides || {};

	const base: Reference = {
		...createFakeReferenceMinimal(props),
		contributors: [],
		description: description ?? "",
		groups: [],
		restrictSourceTypes: false,
		sourceTypes: ["isolate", "strain"],
		users: [
			{
				...createFakeUserNested(),
				build: true,
				createdAt: faker.date.past(),
				modify: true,
				modifyOtu: true,
			},
		],
	};

	return { ...base, ...props };
}
