import { describe, expect, it } from "vitest";
import v1Paired from "./fixtures/samplesheet_v1_paired.csv?raw";
import v1SingleLanes from "./fixtures/samplesheet_v1_single_lanes.csv?raw";
import v2Paired from "./fixtures/samplesheet_v2_paired.csv?raw";
import v2SingleLanes from "./fixtures/samplesheet_v2_single_lanes.csv?raw";
import {
	inferInstrumentModel,
	parseIlluminaFilename,
	parseIlluminaHeader,
	parseSampleSheet,
} from "./illumina";

describe("parseIlluminaHeader", () => {
	it("parses a paired CASAVA 1.8 header", () => {
		expect(
			parseIlluminaHeader(
				"@M00123:42:000000000-ABCDE:1:1101:15589:1331 2:N:0:TAAGGCGA+CTCTCTAT",
			),
		).toEqual({
			instrument: "M00123",
			runNumber: 42,
			flowcell: "000000000-ABCDE",
			lane: 1,
			readSide: 2,
		});
	});

	it("parses a single-end header from a later lane", () => {
		expect(
			parseIlluminaHeader("@A01234:7:HXXXXDSXY:4:1101:1000:2000 1:N:0:1"),
		).toEqual({
			instrument: "A01234",
			runNumber: 7,
			flowcell: "HXXXXDSXY",
			lane: 4,
			readSide: 1,
		});
	});

	it("accepts negative X and Y coordinates", () => {
		expect(
			parseIlluminaHeader(
				"@M00123:42:000000000-ABCDE:1:1101:-15589:-1331 1:N:0:TAAGGCGA",
			),
		).toMatchObject({ instrument: "M00123", runNumber: 42, lane: 1 });
	});

	it("accepts a UMI field after the coordinates", () => {
		expect(
			parseIlluminaHeader(
				"@LH00123:15:22ABCDLT3:2:1101:1000:2000:ACGTACGT 1:N:0:ACGT",
			),
		).toMatchObject({ instrument: "LH00123", flowcell: "22ABCDLT3", lane: 2 });
	});

	it("leaves the read side null when the comment is missing", () => {
		expect(
			parseIlluminaHeader("@VH00123:3:AAAXXX:1:1101:1000:2000"),
		).toMatchObject({ readSide: null });
	});

	it("returns null for a pre-1.8 header without run number and flowcell", () => {
		expect(parseIlluminaHeader("@HWUSI-EAS100R:6:73:941:1973#0/1")).toBeNull();
	});

	it.each([
		[
			"an SRA header",
			"@SRR001666.1 071112_SLXA-EAS1_s_7:5:1:817:345 length=36",
		],
		["a Nanopore header", "@0a1b2c3d-1234 runid=abc read=12 ch=7"],
		[
			"a non-numeric lane",
			"@M00123:42:000000000-ABCDE:X:1101:15589:1331 1:N:0:1",
		],
		["a negative tile", "@M00123:42:FC:1:-1101:15589:1331 1:N:0:1"],
		["a non-numeric tile", "@M00123:42:FC:1:tile:15589:1331 1:N:0:1"],
		["a missing @", "M00123:42:000000000-ABCDE:1:1101:15589:1331 1:N:0:1"],
		["an empty line", ""],
	])("returns null for %s", (_, line) => {
		expect(parseIlluminaHeader(line)).toBeNull();
	});
});

describe("inferInstrumentModel", () => {
	it.each([
		["M00123", "MiSeq"],
		["MN00456", "MiniSeq"],
		["FS10000123", "iSeq"],
		["NB501234", "NextSeq 500/550"],
		["NS500123", "NextSeq 500/550"],
		["VH00123", "NextSeq 1000/2000"],
		["VL00123", "NextSeq 1000/2000"],
		["A01234", "NovaSeq 6000"],
		["LH00123", "NovaSeq X"],
		["SN1234", "HiSeq 2000"],
		["D00123", "HiSeq 1500/2500"],
		["K00123", "HiSeq 3000/4000"],
		["ST-E00123", "HiSeq X"],
	])("infers the model of %s", (serial, model) => {
		expect(inferInstrumentModel(serial)).toBe(model);
	});

	it.each(["HWUSI-EAS100R", "MX123", "unknown", ""])(
		"returns null for %j",
		(serial) => {
			expect(inferInstrumentModel(serial)).toBeNull();
		},
	);
});

describe("parseIlluminaFilename", () => {
	it("parses a lane-split R1 name", () => {
		expect(parseIlluminaFilename("Leaf_A_S1_L001_R1_001.fastq.gz")).toEqual({
			sampleId: "Leaf_A",
			sampleNumber: 1,
			lane: 1,
			readSide: 1,
		});
	});

	it("parses a lane-merged R2 name", () => {
		expect(parseIlluminaFilename("S2_S12_R2_001.fastq.gz")).toEqual({
			sampleId: "S2",
			sampleNumber: 12,
			lane: null,
			readSide: 2,
		});
	});

	it("parses an uncompressed single-end name", () => {
		expect(parseIlluminaFilename("Undetermined_S0_L004_R1_001.fastq")).toEqual({
			sampleId: "Undetermined",
			sampleNumber: 0,
			lane: 4,
			readSide: 1,
		});
	});

	it.each([
		"sample_R1.fastq.gz",
		"sample.1.fq.gz",
		"S1_S1_L001_I1_001.fastq.gz",
		"S1_S1_L001_R3_001.fastq.gz",
		"S1_S1_L1_R1_001.fastq.gz",
		"_S1_R1_001.fastq.gz",
		"S1_S1_R1_001.fastq.gz.bak",
	])("returns null for %s", (name) => {
		expect(parseIlluminaFilename(name)).toBeNull();
	});
});

describe("parseSampleSheet", () => {
	it("parses a paired v1 sheet with CRLF endings and quoted fields", () => {
		expect(parseSampleSheet(v1Paired)).toEqual({
			version: 1,
			header: {
				IEMFileVersion: "4",
				"Investigator Name": "Jane",
				"Experiment Name": "Run42",
				Date: "2024-03-01",
				Workflow: "GenerateFASTQ",
				Chemistry: "Amplicon",
			},
			reads: [151, 151],
			entries: [
				{
					sampleId: "S1",
					sampleName: "Leaf A",
					sampleProject: "Grapevine",
					index: "TAAGGCGA",
					index2: "CTCTCTAT",
					lane: null,
				},
				{
					sampleId: "S2",
					sampleName: "Leaf B",
					sampleProject: "Grapevine",
					index: "CGTACTAG",
					index2: "CTCTCTAT",
					lane: null,
				},
			],
		});
	});

	it("parses a single-end, lane-split v1 sheet", () => {
		const sheet = parseSampleSheet(v1SingleLanes);

		expect(sheet.version).toBe(1);
		expect(sheet.reads).toEqual([75]);
		expect(sheet.entries).toEqual([
			{
				sampleId: "S1",
				sampleName: null,
				sampleProject: "Potato",
				index: "ACGTACGT",
				index2: null,
				lane: 1,
			},
			{
				sampleId: "S1",
				sampleName: null,
				sampleProject: "Potato",
				index: "ACGTACGT",
				index2: null,
				lane: 2,
			},
		]);
	});

	it("parses a paired v2 sheet, leaving index cycles out of reads", () => {
		expect(parseSampleSheet(v2Paired)).toEqual({
			version: 2,
			header: {
				FileFormatVersion: "2",
				RunName: "Run7",
				InstrumentPlatform: "NextSeq1k2k",
				InstrumentType: "NextSeq2000",
			},
			reads: [151, 151],
			entries: [
				{
					sampleId: "S1",
					sampleName: null,
					sampleProject: "Hops",
					index: "AACCGGTTAA",
					index2: "TTGGCCAATT",
					lane: null,
				},
				{
					sampleId: "S2",
					sampleName: null,
					sampleProject: "Hops",
					index: "CCGGTTAAGG",
					index2: "GGCCAATTGG",
					lane: null,
				},
			],
		});
	});

	it("parses a single-end, lane-split v2 sheet", () => {
		const sheet = parseSampleSheet(v2SingleLanes);

		expect(sheet.version).toBe(2);
		expect(sheet.reads).toEqual([101]);
		expect(sheet.entries.map((entry) => [entry.sampleId, entry.lane])).toEqual([
			["S1", 1],
			["S1", 2],
			["S2", 3],
		]);
	});

	it("treats a zero Read2Cycles as single-end", () => {
		const sheet = parseSampleSheet(
			"[Header]\nFileFormatVersion,2\n[Reads]\nRead1Cycles,101\nRead2Cycles,0\n[BCLConvert_Data]\nSample_ID\nS1",
		);

		expect(sheet.reads).toEqual([101]);
	});

	it.each([
		["a missing [Header]", "[Data]\nSample_ID\nS1", /missing \[Header\]/],
		["a missing [Data]", "[Header]\nIEMFileVersion,4", /missing \[Data\]/],
		[
			"a v2 sheet without [BCLConvert_Data]",
			"[Header]\nFileFormatVersion,2\n[Data]\nSample_ID\nS1",
			/missing \[BCLConvert_Data\]/,
		],
		[
			"content before the first section",
			"hello\n[Header]\n[Data]\nSample_ID",
			/before the first section/,
		],
		[
			"a duplicate section",
			"[Header]\n[Header]\n[Data]\nSample_ID",
			/duplicate \[Header\]/,
		],
		["an empty data section", "[Header]\n[Data]", /no header row/],
		[
			"no Sample_ID column",
			"[Header]\n[Data]\nSample_Name\nA",
			/no Sample_ID column/,
		],
		[
			"an empty Sample_ID",
			"[Header]\n[Data]\nSample_ID,index\n,ACGT",
			/row 1 has no Sample_ID/,
		],
		[
			"a non-numeric lane",
			"[Header]\n[Data]\nLane,Sample_ID\nA,S1",
			/non-numeric lane/,
		],
		["extra fields", "[Header]\n[Data]\nSample_ID\nS1,extra", /more fields/],
		[
			"a non-numeric read",
			"[Header]\n[Reads]\nabc\n[Data]\nSample_ID",
			/cycle count/,
		],
		[
			"a v2 sheet without Read1Cycles",
			"[Header]\nFileFormatVersion,2\n[Reads]\nRead2Cycles,151\n[BCLConvert_Data]\nSample_ID",
			/cycle count for Read1Cycles/,
		],
		[
			"a zero v2 read",
			"[Header]\nFileFormatVersion,2\n[Reads]\nRead1Cycles,0\n[BCLConvert_Data]\nSample_ID",
			/cycle count for Read1Cycles/,
		],
		[
			"an unterminated quote",
			'[Header]\n[Data]\nSample_ID\n"S1',
			/unterminated/,
		],
	])("throws on %s", (_, text, message) => {
		expect(() => parseSampleSheet(text)).toThrow(message);
	});
});
