import { describe, expect, it } from "vitest";
import { IndexSnapshotOtuError, toSnapshotOtu } from "./snapshot";

const SEQUENCE = {
	_id: "seq_1",
	accession: "NC_000001",
	definition: "Alpha virus complete genome",
	host: "Musa sp.",
	segment: "DNA A",
	sequence: "ACGTACGTAC",
};

const ISOLATE = {
	id: "iso_1",
	default: true,
	sequences: [SEQUENCE],
	source_name: "A1",
	source_type: "isolate",
};

const OTU = {
	_id: "otualpha",
	abbreviation: "AV",
	isolates: [ISOLATE],
	name: "Alpha virus",
	schema: [{ molecule: "ssRNA", name: "DNA A", required: true }],
	taxid: 1234,
	version: 4,
};

describe("toSnapshotOtu", () => {
	it("carries every field the artifact records", () => {
		expect(toSnapshotOtu(OTU)).toEqual({
			abbreviation: "AV",
			id: "otualpha",
			isolates: [
				{
					default: true,
					id: "iso_1",
					sequences: [
						{
							accession: "NC_000001",
							definition: "Alpha virus complete genome",
							host: "Musa sp.",
							id: "seq_1",
							segment: "DNA A",
							sequence: "ACGTACGTAC",
						},
					],
					source_name: "A1",
					source_type: "isolate",
				},
			],
			name: "Alpha virus",
			schema: [{ molecule: "ssRNA", name: "DNA A", required: true }],
			taxid: 1234,
			version: 4,
		});
	});

	// The three a legitimate document may omit. Everything else is an error,
	// because a column filled with a default is indistinguishable downstream from
	// one the curator actually set.
	it("defaults an absent abbreviation, taxid and schema", () => {
		const { abbreviation, taxid, schema, ...rest } = OTU;

		expect(toSnapshotOtu(rest)).toMatchObject({
			abbreviation: "",
			schema: [],
			taxid: null,
		});
	});

	it("defaults a schema item's absent required flag to true", () => {
		expect(
			toSnapshotOtu({ ...OTU, schema: [{ name: "DNA A" }] }).schema,
		).toEqual([{ molecule: null, name: "DNA A", required: true }]);
	});

	it("reads an id from either spelling", () => {
		expect(toSnapshotOtu({ ...OTU, _id: undefined, id: "otubeta" }).id).toBe(
			"otubeta",
		);
	});

	it.each([
		["name", { ...OTU, name: undefined }],
		["version", { ...OTU, version: undefined }],
		["isolates", { ...OTU, isolates: undefined }],
		["an id", { ...OTU, _id: undefined }],
		["a source_name", { ...OTU, isolates: [{ ...ISOLATE, source_name: 7 }] }],
		[
			"a sequence's accession",
			{
				...OTU,
				isolates: [
					{ ...ISOLATE, sequences: [{ ...SEQUENCE, accession: undefined }] },
				],
			},
		],
	])("refuses a document with no %s", (_, document) => {
		expect(() => toSnapshotOtu(document)).toThrow(IndexSnapshotOtuError);
	});

	// A null host or segment is ordinary — an unplaced sequence has neither — and
	// must not be mistaken for a missing field.
	it("keeps a null host and segment", () => {
		const document = {
			...OTU,
			isolates: [
				{ ...ISOLATE, sequences: [{ ...SEQUENCE, host: null, segment: null }] },
			],
		};

		expect(toSnapshotOtu(document).isolates[0]?.sequences[0]).toMatchObject({
			host: null,
			segment: null,
		});
	});
});
