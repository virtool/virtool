import { describe, expect, it } from "vitest";
import { CreateLocalOtuCommand } from "./otusV2";

const IDS = {
	otu: "00000000-0000-4000-8000-000000000001",
	identity: "00000000-0000-4000-8000-000000000002",
	plan: "00000000-0000-4000-8000-000000000003",
	segment: "00000000-0000-4000-8000-000000000004",
	isolate: "00000000-0000-4000-8000-000000000005",
	sequence: "00000000-0000-4000-8000-000000000006",
};

function createCommand() {
	return {
		type: "CreateOTU" as const,
		schemaVersion: 1 as const,
		otuId: IDS.otu,
		expectedVersion: 0 as const,
		payload: {
			molecule: {
				type: "RNA" as const,
				strandedness: "single" as const,
				topology: "linear" as const,
			},
			plan: {
				id: IDS.plan,
				segments: [
					{
						id: IDS.segment,
						name: null,
						length: 8,
						lengthTolerance: 0,
						rule: "required" as const,
					},
				],
			},
			taxonomy: {
				kind: "local" as const,
				identityId: IDS.identity,
				name: "Novel virus",
				acronym: "NV",
			},
			promotedAccessions: [],
			isolate: {
				id: IDS.isolate,
				name: { type: "isolate" as const, value: "Lab 1" },
				sequences: [
					{
						id: IDS.sequence,
						definition: "Complete genome",
						sequence: "atcg nnry",
						segmentId: IDS.segment,
					},
				],
			},
		},
	};
}

describe("CreateLocalOtuCommand", () => {
	it("parses and normalizes a complete local OTU", () => {
		const command = CreateLocalOtuCommand.parse(createCommand());

		expect(command.payload.isolate.sequences[0].sequence).toBe("ATCGNNRY");
	});

	it.each([
		[
			"empty isolate",
			(command: ReturnType<typeof createCommand>) => {
				command.payload.isolate.sequences = [];
			},
		],
		[
			"unknown segment",
			(command: ReturnType<typeof createCommand>) => {
				command.payload.isolate.sequences[0].segmentId = IDS.identity;
			},
		],
		[
			"duplicate segment",
			(command: ReturnType<typeof createCommand>) => {
				command.payload.plan.segments.push(command.payload.plan.segments[0]);
			},
		],
		[
			"duplicate sequence",
			(command: ReturnType<typeof createCommand>) => {
				command.payload.isolate.sequences.push(
					command.payload.isolate.sequences[0],
				);
			},
		],
		[
			"invalid sequence",
			(command: ReturnType<typeof createCommand>) => {
				command.payload.isolate.sequences[0].sequence = "ATXG";
			},
		],
		[
			"empty sequence",
			(command: ReturnType<typeof createCommand>) => {
				command.payload.isolate.sequences[0].sequence = "   ";
			},
		],
		[
			"wrong length",
			(command: ReturnType<typeof createCommand>) => {
				command.payload.isolate.sequences[0].sequence = "ATCG";
			},
		],
		[
			"unfilled required segment",
			(command: ReturnType<typeof createCommand>) => {
				command.payload.plan.segments.push({
					id: "00000000-0000-4000-8000-000000000007",
					name: null,
					length: 8,
					lengthTolerance: 0,
					rule: "required" as const,
				});
			},
		],
	])("rejects %s", (_label, mutate) => {
		const command = createCommand();
		mutate(command);

		expect(CreateLocalOtuCommand.safeParse(command).success).toBe(false);
	});

	it("rejects unknown fields", () => {
		expect(
			CreateLocalOtuCommand.safeParse({ ...createCommand(), extra: true })
				.success,
		).toBe(false);
	});
});
