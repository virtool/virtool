import { faker } from "@faker-js/faker";
import {
	type LocalOtuV2,
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
			userId: faker.number.int(),
			createdAt: faker.date.past(),
		},
	};

	return { ...base, ...overrides };
}
