import { faker } from "@faker-js/faker";
import {
	type LocalOtuV2,
	type LocalOtuV2Summary,
	OtuV2IsolateNameType,
	OtuV2MoleculeType,
	OtuV2SegmentRule,
	OtuV2Strandedness,
	OtuV2Topology,
} from "@virtool/contracts";

/** Create a fake complete local v2 OTU read model with one segment and sequence. */
export function createFakeLocalOtuV2(
	overrides?: Partial<LocalOtuV2>,
): LocalOtuV2 {
	const segmentId = faker.string.uuid();

	const base: LocalOtuV2 = {
		id: faker.string.uuid(),
		referenceId: faker.string.uuid(),
		version: 1,
		molecule: {
			type: OtuV2MoleculeType.RNA,
			strandedness: OtuV2Strandedness.single,
			topology: OtuV2Topology.linear,
		},
		taxonomy: {
			kind: "local",
			identityId: faker.string.uuid(),
			name: faker.word.noun({ strategy: "any-length" }),
			acronym: null,
		},
		plan: {
			id: faker.string.uuid(),
			segments: [
				{
					id: segmentId,
					name: null,
					length: 6,
					lengthTolerance: 0.05,
					rule: OtuV2SegmentRule.required,
				},
			],
		},
		isolates: [
			{
				id: faker.string.uuid(),
				name: {
					type: OtuV2IsolateNameType.isolate,
					value: faker.word.noun({ strategy: "any-length" }),
				},
				sequences: [
					{
						id: faker.string.uuid(),
						definition: faker.lorem.sentence(),
						sequence: "ATCGAT",
						segmentId,
					},
				],
			},
		],
		createdAt: faker.date.past(),
		mostRecentChange: {
			version: 1,
			command: "CreateOTU",
			commandSchemaVersion: 1,
			source: "user",
			user: {
				id: faker.number.int(),
				handle: faker.internet.username(),
			},
			createdAt: faker.date.past(),
		},
	};

	return { ...base, ...overrides };
}

/** Create a fake local v2 OTU list summary. */
export function createFakeLocalOtuV2Summary(
	overrides?: Partial<LocalOtuV2Summary>,
): LocalOtuV2Summary {
	const base: LocalOtuV2Summary = {
		id: faker.string.uuid(),
		name: faker.word.noun({ strategy: "any-length" }),
		acronym: null,
		version: 1,
		isolateCount: 1,
	};

	return { ...base, ...overrides };
}
