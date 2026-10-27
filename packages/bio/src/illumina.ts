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

	/** The file chunk: always `1` from BCL Convert; `1`, `2`, ... from bcl2fastq with `--fastq-cluster-count` */
	chunk: number;
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
 * @public
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
 * @public
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
	/^(.+)_S(\d+)(?:_L(\d{3}))?_R([12])_(\d{3})\.fastq(?:\.gz)?$/;

/**
 * Parse a BCL Convert or bcl2fastq FASTQ filename:
 * `<Sample_ID>_S<n>[_L<lane>]_R<1|2>_<chunk>.fastq.gz`.
 *
 * Returns `null` for names that don't follow the pattern.
 *
 * @param name - the filename, without any directory
 * @public
 */
export function parseIlluminaFilename(name: string): IlluminaFilename | null {
	const match = FILENAME_PATTERN.exec(name);

	if (match === null) {
		return null;
	}

	const [, sampleId = "", sampleNumber, lane, readSide, chunk] = match;

	return {
		sampleId,
		sampleNumber: Number(sampleNumber),
		lane: lane === undefined ? null : Number(lane),
		readSide: Number(readSide) as ReadSide,
		chunk: Number(chunk),
	};
}

/**
 * Parse a v1 (Illumina Experiment Manager) or v2 (BCL Convert) sample sheet.
 *
 * A sheet is read as v2 when its `[Header]` declares `FileFormatVersion,2`,
 * matched case-insensitively, or when it has a `[BCLConvert_Data]` section;
 * any other sheet is read as v1 and needs a `[Data]` section. Index-read
 * cycles are left out of `reads` because a v1 sheet doesn't record them.
 *
 * Throws on a malformed sheet. Unlike a header or filename, a sample sheet is
 * supplied on purpose, so the user needs to know why it was rejected.
 *
 * @param text - the whole sample sheet
 * @public
 */
export function parseSampleSheet(text: string): SampleSheet {
	const sections = splitSections(text);

	const headerRows = sections.get("header");

	if (headerRows === undefined) {
		throw new Error("Malformed sample sheet: missing [Header] section");
	}

	const header = parseKeyValues(headerRows);
	const version =
		getHeaderValue(header, "FileFormatVersion") === "2" ||
		sections.has("bclconvert_data")
			? 2
			: 1;

	const dataRows = sections.get(version === 2 ? "bclconvert_data" : "data");

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

	for (const row of parseCsv(text.replace(/^﻿/, ""))) {
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

/**
 * Split CSV text into rows of trimmed cells. A quoted cell can hold commas,
 * doubled quotes, and line breaks, so quote state carries across lines and
 * `\r\n`, `\r`, and `\n` end a row only outside quotes.
 */
function parseCsv(text: string): string[][] {
	const rows: string[][] = [];
	let cells: string[] = [];
	let cell = "";
	let quoted = false;

	for (let i = 0; i < text.length; i++) {
		const char = text[i];

		if (quoted) {
			if (char === '"' && text[i + 1] === '"') {
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
		} else if (char === "\n" || char === "\r") {
			if (char === "\r" && text[i + 1] === "\n") {
				i++;
			}

			cells.push(cell.trim());
			rows.push(cells);
			cells = [];
			cell = "";
		} else {
			cell += char;
		}
	}

	if (quoted) {
		throw new Error("Malformed sample sheet: unterminated quoted field");
	}

	cells.push(cell.trim());
	rows.push(cells);

	return rows;
}

/**
 * The record has no prototype, so a key such as `__proto__` or `constructor`
 * is stored and read back like any other.
 */
function parseKeyValues(rows: string[][]): Record<string, string> {
	const values: Record<string, string> = Object.create(null);

	for (const [key = "", value = ""] of rows) {
		values[key] = value;
	}

	return values;
}

/** Look up a `[Header]` value by key, ignoring the key's case. */
function getHeaderValue(
	header: Record<string, string>,
	name: string,
): string | undefined {
	const lowered = name.toLowerCase();

	for (const [key, value] of Object.entries(header)) {
		if (key.toLowerCase() === lowered) {
			return value;
		}
	}

	return undefined;
}

function parseCycles(raw: string | undefined, name: string): number {
	if (raw === undefined || !INTEGER_PATTERN.test(raw)) {
		throw new Error(
			`Malformed sample sheet: expected a cycle count for ${name}, got ${raw}`,
		);
	}

	return Number(raw);
}

/**
 * Parse the named cycle counts in order. A count of zero marks a read the run
 * doesn't have, so it is dropped; the first read can't be dropped because a run
 * needs at least one.
 */
function parseReads(counts: [string, string | undefined][]): number[] {
	const reads: number[] = [];

	for (const [name, raw] of counts) {
		const cycles = parseCycles(raw, name);

		if (cycles === 0) {
			if (reads.length === 0) {
				throw new Error(
					`Malformed sample sheet: ${name} is 0, but a run needs at least one sequencing read`,
				);
			}

			continue;
		}

		reads.push(cycles);
	}

	return reads;
}

/** A v1 `[Reads]` section lists one cycle count per sequencing read. */
function parseV1Reads(rows: string[][]): number[] {
	return parseReads(
		rows.map(([cycles], index) => [`read ${index + 1}`, cycles]),
	);
}

/**
 * A v2 `[Reads]` section holds `Read1Cycles`, `Index1Cycles`, and so on. A
 * single-end sheet can omit `Read2Cycles` or set it to `0`.
 */
function parseV2Reads(rows: string[][]): number[] {
	const values = parseKeyValues(rows);
	const counts: [string, string | undefined][] = [
		["Read1Cycles", values.Read1Cycles],
	];

	if (values.Read2Cycles !== undefined) {
		counts.push(["Read2Cycles", values.Read2Cycles]);
	}

	return parseReads(counts);
}

function parseEntries(rows: string[][]): SampleSheetEntry[] {
	const [columns, ...records] = rows;

	if (columns === undefined) {
		throw new Error("Malformed sample sheet: data section has no header row");
	}

	const lowered = columns.map((column) => column.toLowerCase());
	const sampleIdIndex = lowered.indexOf("sample_id");

	if (sampleIdIndex === -1) {
		throw new Error(
			"Malformed sample sheet: data section has no Sample_ID column",
		);
	}

	const sampleNameIndex = lowered.indexOf("sample_name");
	const sampleProjectIndex = lowered.indexOf("sample_project");
	const indexIndex = lowered.indexOf("index");
	const index2Index = lowered.indexOf("index2");
	const laneIndex = lowered.indexOf("lane");

	const seen = new Set<string>();

	return records.map((record, row) => {
		if (
			record.length > columns.length &&
			record.slice(columns.length).some(Boolean)
		) {
			throw new Error(
				`Malformed sample sheet: data row ${row + 1} has more fields than the header`,
			);
		}

		const sampleId = getCell(record, sampleIdIndex);

		if (sampleId === null) {
			throw new Error(
				`Malformed sample sheet: data row ${row + 1} has no Sample_ID`,
			);
		}

		const rawLane = getCell(record, laneIndex);

		if (rawLane !== null && !INTEGER_PATTERN.test(rawLane)) {
			throw new Error(
				`Malformed sample sheet: data row ${row + 1} has a non-numeric lane, ${rawLane}`,
			);
		}

		const lane = rawLane === null ? null : Number(rawLane);

		if (lane === 0) {
			throw new Error(
				`Malformed sample sheet: data row ${row + 1} has lane 0; lanes start at 1`,
			);
		}

		// A newline can't appear in a cell, so it can't collide with a Sample_ID.
		const key = lane === null ? sampleId : `${sampleId}\n${lane}`;

		if (seen.has(key)) {
			throw new Error(
				`Malformed sample sheet: data row ${row + 1} repeats Sample_ID ${sampleId}${lane === null ? "" : ` in lane ${lane}`}`,
			);
		}

		seen.add(key);

		return {
			sampleId,
			sampleName: getCell(record, sampleNameIndex),
			sampleProject: getCell(record, sampleProjectIndex),
			index: getCell(record, indexIndex),
			index2: getCell(record, index2Index),
			lane,
		};
	});
}

/** Read one cell; a missing column or an empty cell reads as `null`. */
function getCell(record: string[], index: number): string | null {
	if (index === -1) {
		return null;
	}

	return record[index] || null;
}
