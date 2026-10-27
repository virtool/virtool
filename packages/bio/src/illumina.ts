/** Which mate of a read pair a file or record belongs to. */
export type ReadSide = 1 | 2;

/** The run identity carried by one CASAVA 1.8+ FASTQ header. */
export type IlluminaHeader = {
	/** The instrument serial, such as `M00123` or `A01234` */
	instrument: string;
	runNumber: number;
	flowcell: string;
	lane: number;

	/** The mate the record belongs to, or `null` when the header omits it */
	readSide: ReadSide | null;
};

/** The parts of a BCL Convert FASTQ filename. */
export type IlluminaFilename = {
	sampleId: string;

	/** The `S<n>` number: the sample's position in the sheet, `0` for undetermined reads */
	sampleNumber: number;

	/** The lane, or `null` when BCL Convert merged the lanes */
	lane: number | null;
	readSide: ReadSide;
};

/** One `[Data]` or `[BCLConvert_Data]` row of a sample sheet. */
export type SampleSheetEntry = {
	sampleId: string;
	sampleName: string | null;
	sampleProject: string | null;
	index: string | null;
	index2: string | null;
	lane: number | null;
};

/** A v1 (IEM) or v2 (BCL Convert) sample sheet, normalised to one shape. */
export type SampleSheet = {
	version: 1 | 2;

	/** The `[Header]` key-value pairs, as written */
	header: Record<string, string>;

	/** The cycle count of each sequencing read, in order, excluding index reads */
	reads: number[];
	entries: SampleSheetEntry[];
};

const HEADER_NAME_PATTERN = /^[A-Za-z0-9_-]+$/;

const INTEGER_PATTERN = /^\d+$/;

const SIGNED_INTEGER_PATTERN = /^-?\d+$/;

/**
 * Parse the run identity from a CASAVA 1.8+ FASTQ header line:
 * `@<instrument>:<run>:<flowcell>:<lane>:<tile>:<x>:<y>[:<umi>] <read>:<filtered>:<control>:<index>`.
 *
 * Returns `null` rather than throwing for anything else, including pre-1.8
 * headers, which carry no run number or flowcell. Header reading must never
 * fail an upload.
 *
 * @param line - the first line of a FASTQ record, including the leading `@`
 */
export function parseIlluminaHeader(line: string): IlluminaHeader | null {
	if (!line.startsWith("@")) {
		return null;
	}

	const [name = "", comment] = line.slice(1).trim().split(/\s+/, 2);
	const fields = name.split(":");

	if (fields.length !== 7 && fields.length !== 8) {
		return null;
	}

	const [instrument = "", runNumber = "", flowcell = "", lane = ""] = fields;

	if (
		!HEADER_NAME_PATTERN.test(instrument) ||
		!HEADER_NAME_PATTERN.test(flowcell) ||
		!INTEGER_PATTERN.test(fields[4] ?? "") ||
		// Tile edge clusters can have negative X and Y coordinates.
		!fields.slice(5, 7).every((field) => SIGNED_INTEGER_PATTERN.test(field)) ||
		!INTEGER_PATTERN.test(runNumber) ||
		!INTEGER_PATTERN.test(lane)
	) {
		return null;
	}

	return {
		instrument,
		runNumber: Number(runNumber),
		flowcell,
		lane: Number(lane),
		readSide: parseHeaderReadSide(comment),
	};
}

function parseHeaderReadSide(comment: string | undefined): ReadSide | null {
	const read = comment?.split(":")[0];

	if (read === "1" || read === "2") {
		return Number(read) as ReadSide;
	}

	return null;
}

/** Serial patterns in the order they are tried, so `MN` is tested before `M`. */
const INSTRUMENT_MODELS: [RegExp, string][] = [
	[/^MN\d+$/, "MiniSeq"],
	[/^M\d+$/, "MiSeq"],
	[/^FS\d+$/, "iSeq"],
	[/^N[BS]\d+$/, "NextSeq 500/550"],
	[/^V[HL]\d+$/, "NextSeq 1000/2000"],
	[/^A\d+$/, "NovaSeq 6000"],
	[/^LH\d+$/, "NovaSeq X"],
	[/^SN\d+$/, "HiSeq 2000"],
	[/^[CD]\d+$/, "HiSeq 1500/2500"],
	[/^[JK]\d+$/, "HiSeq 3000/4000"],
	[/^(?:ST-)?E\d+$/, "HiSeq X"],
];

/**
 * Guess the instrument model from its serial prefix. This is a heuristic for
 * pre-filling a form, never for overriding a model the user chose.
 *
 * @param serial - the instrument serial from a FASTQ header
 */
export function inferInstrumentModel(serial: string): string | null {
	for (const [pattern, model] of INSTRUMENT_MODELS) {
		if (pattern.test(serial)) {
			return model;
		}
	}

	return null;
}

const FILENAME_PATTERN =
	/^(.+)_S(\d+)(?:_L(\d{3}))?_R([12])_001\.fastq(?:\.gz)?$/;

/**
 * Parse a BCL Convert FASTQ filename:
 * `<Sample_ID>_S<n>[_L<lane>]_R<1|2>_001.fastq.gz`.
 *
 * Returns `null` for names that don't follow the pattern.
 *
 * @param name - the filename, without any directory
 */
export function parseIlluminaFilename(name: string): IlluminaFilename | null {
	const match = FILENAME_PATTERN.exec(name);

	if (match === null) {
		return null;
	}

	const [, sampleId = "", sampleNumber, lane, readSide] = match;

	return {
		sampleId,
		sampleNumber: Number(sampleNumber),
		lane: lane === undefined ? null : Number(lane),
		readSide: Number(readSide) as ReadSide,
	};
}

/**
 * Parse a v1 (Illumina Experiment Manager) or v2 (BCL Convert) sample sheet.
 *
 * A v2 sheet declares `FileFormatVersion,2` in its `[Header]`; any other sheet
 * with a `[Data]` section is read as v1. Index-read cycles are left out of
 * `reads` because a v1 sheet doesn't record them.
 *
 * Throws on a malformed sheet. Unlike a header or filename, a sample sheet is
 * supplied on purpose, so the user needs to know why it was rejected.
 *
 * @param text - the whole sample sheet
 */
export function parseSampleSheet(text: string): SampleSheet {
	const sections = splitSections(text);

	const headerRows = sections.get("header");

	if (headerRows === undefined) {
		throw new Error("Malformed sample sheet: missing [Header] section");
	}

	const header = parseKeyValues(headerRows);
	const version = header.FileFormatVersion === "2" ? 2 : 1;

	const dataName = version === 2 ? "bclconvert_data" : "data";
	const dataRows = sections.get(dataName);

	if (dataRows === undefined) {
		throw new Error(
			`Malformed sample sheet: missing [${version === 2 ? "BCLConvert_Data" : "Data"}] section`,
		);
	}

	const readRows = sections.get("reads") ?? [];

	return {
		version,
		header,
		reads: version === 2 ? parseV2Reads(readRows) : parseV1Reads(readRows),
		entries: parseEntries(dataRows),
	};
}

/**
 * Split a sheet into its sections, keyed by lowercase name. Blank rows and rows
 * of only commas, which spreadsheet editors pad sheets with, are dropped.
 */
function splitSections(text: string): Map<string, string[][]> {
	const sections = new Map<string, string[][]>();
	let current: string[][] | null = null;

	for (const line of text.replace(/^﻿/, "").split(/\r?\n/)) {
		const row = splitCsvLine(line);

		if (row.every((cell) => cell === "")) {
			continue;
		}

		const sectionMatch = /^\[(.+)\]$/.exec(row[0] ?? "");

		if (sectionMatch) {
			const name = (sectionMatch[1] ?? "").toLowerCase();

			if (sections.has(name)) {
				throw new Error(
					`Malformed sample sheet: duplicate [${sectionMatch[1]}] section`,
				);
			}

			current = [];
			sections.set(name, current);
			continue;
		}

		if (current === null) {
			throw new Error(
				"Malformed sample sheet: content before the first section",
			);
		}

		current.push(row);
	}

	return sections;
}

function splitCsvLine(line: string): string[] {
	const cells: string[] = [];
	let cell = "";
	let quoted = false;

	for (let i = 0; i < line.length; i++) {
		const char = line[i];

		if (quoted) {
			if (char === '"' && line[i + 1] === '"') {
				cell += '"';
				i++;
			} else if (char === '"') {
				quoted = false;
			} else {
				cell += char;
			}
		} else if (char === '"') {
			quoted = true;
		} else if (char === ",") {
			cells.push(cell.trim());
			cell = "";
		} else {
			cell += char;
		}
	}

	if (quoted) {
		throw new Error("Malformed sample sheet: unterminated quoted field");
	}

	cells.push(cell.trim());

	return cells;
}

function parseKeyValues(rows: string[][]): Record<string, string> {
	const values: Record<string, string> = {};

	for (const [key = "", value = ""] of rows) {
		values[key] = value;
	}

	return values;
}

function parseCycles(raw: string | undefined, name: string): number {
	if (raw === undefined || !INTEGER_PATTERN.test(raw) || Number(raw) === 0) {
		throw new Error(
			`Malformed sample sheet: expected a positive cycle count for ${name}, got ${raw}`,
		);
	}

	return Number(raw);
}

/** A v1 `[Reads]` section lists one cycle count per sequencing read. */
function parseV1Reads(rows: string[][]): number[] {
	return rows.map(([cycles]) => parseCycles(cycles, "read"));
}

/**
 * A v2 `[Reads]` section holds `Read1Cycles`, `Index1Cycles`, and so on. A
 * single-end sheet can omit `Read2Cycles` or set it to `0`.
 */
function parseV2Reads(rows: string[][]): number[] {
	const values = parseKeyValues(rows);
	const reads = [parseCycles(values.Read1Cycles, "Read1Cycles")];

	if (values.Read2Cycles !== undefined && values.Read2Cycles !== "0") {
		reads.push(parseCycles(values.Read2Cycles, "Read2Cycles"));
	}

	return reads;
}

function parseEntries(rows: string[][]): SampleSheetEntry[] {
	const [columns, ...records] = rows;

	if (columns === undefined) {
		throw new Error("Malformed sample sheet: data section has no header row");
	}

	const lowered = columns.map((column) => column.toLowerCase());

	if (!lowered.includes("sample_id")) {
		throw new Error(
			"Malformed sample sheet: data section has no Sample_ID column",
		);
	}

	return records.map((record, row) => {
		if (
			record.length > columns.length &&
			record.slice(columns.length).some(Boolean)
		) {
			throw new Error(
				`Malformed sample sheet: data row ${row + 1} has more fields than the header`,
			);
		}

		function get(column: string): string | null {
			const value = record[lowered.indexOf(column)];
			return value ? value : null;
		}

		const sampleId = get("sample_id");

		if (sampleId === null) {
			throw new Error(
				`Malformed sample sheet: data row ${row + 1} has no Sample_ID`,
			);
		}

		const lane = get("lane");

		if (lane !== null && !INTEGER_PATTERN.test(lane)) {
			throw new Error(
				`Malformed sample sheet: data row ${row + 1} has a non-numeric lane, ${lane}`,
			);
		}

		return {
			sampleId,
			sampleName: get("sample_name"),
			sampleProject: get("sample_project"),
			index: get("index"),
			index2: get("index2"),
			lane: lane === null ? null : Number(lane),
		};
	});
}
