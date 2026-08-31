import { faker } from "@faker-js/faker";
import { type ReferenceV2, ReferenceV2Kind } from "@virtool/contracts";

/** Create a fake local v2 Reference read model. */
export function createFakeReferenceV2(
	overrides?: Partial<ReferenceV2>,
): ReferenceV2 {
	const base: ReferenceV2 = {
		id: faker.string.uuid(),
		name: faker.word.noun({ strategy: "any-length" }),
		description: faker.lorem.sentence(),
		kind: ReferenceV2Kind.local,
		defaultSegmentLengthTolerance: 0.05,
		archived: false,
		createdAt: faker.date.past(),
		updatedAt: faker.date.past(),
	};

	return { ...base, ...overrides };
}
