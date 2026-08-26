import {
	CreateLocalOtuCommand,
	type GenbankOtuDraft,
} from "@virtool/contracts";
import { describe, expect, it } from "vitest";
import { buildCreateOtuCommandFromDraft } from "./command";

const draft: GenbankOtuDraft = {
	molecule: { type: "RNA", strandedness: "single", topology: "linear" },
	taxonomy: {
		name: "Tobacco mosaic virus",
		acronym: "TMV",
		lineage: [
			{ id: 12234, name: "Virgaviridae", rank: "family" },
			{ id: 12242, name: "Tobamovirus", rank: "genus" },
			{ id: 12243, name: "Tobacco mosaic virus", rank: "species" },
		],
	},
	isolate: { type: "isolate", value: "Fny" },
	segments: [
		{
			name: { prefix: "Segment", key: "RNA1" },
			definition: "RNA 1",
			sequence: "ATCG",
			length: 4,
			accession: "NC_003615.1",
		},
		{
			name: { prefix: "Segment", key: "RNA2" },
			definition: "RNA 2",
			sequence: "GGCC",
			length: 4,
			accession: "NC_003616.1",
		},
	],
};

describe("buildCreateOtuCommandFromDraft", () => {
	it("assembles a command the contract accepts", () => {
		const command = buildCreateOtuCommandFromDraft(draft, 0.05);

		expect(() => CreateLocalOtuCommand.parse(command)).not.toThrow();
	});

	it("maps every segment to a required plan segment and a sequence", () => {
		const command = buildCreateOtuCommandFromDraft(draft, 0.05);

		expect(command.payload.plan.segments).toHaveLength(2);
		expect(
			command.payload.plan.segments.every((s) => s.rule === "required"),
		).toBe(true);
		expect(
			command.payload.plan.segments.every((s) => s.lengthTolerance === 0.05),
		).toBe(true);
		expect(command.payload.isolate.sequences).toHaveLength(2);

		const segmentIds = command.payload.plan.segments.map((s) => s.id);
		expect(command.payload.isolate.sequences.map((s) => s.segmentId)).toEqual(
			segmentIds,
		);
	});

	it("carries the isolate name and taxonomy through", () => {
		const command = buildCreateOtuCommandFromDraft(draft, 0.05);

		expect(command.payload.isolate.name).toEqual({
			type: "isolate",
			value: "Fny",
		});
		expect(command.payload.taxonomy.name).toBe("Tobacco mosaic virus");
		expect(command.payload.taxonomy.acronym).toBe("TMV");
	});
});
