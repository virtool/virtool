import { pluralize } from "@app/format";
import { formatIsolateName } from "@app/utils";
import sortSequencesBySegment from "@otus/utils";
import type {
	OtuIsolate,
	OtuSegment,
	OtuSequence,
	ReferenceExportFastaHeader,
	ReferenceExportTableFormat,
} from "@virtool/contracts";

/** The labels a menu or settings page shows for each FASTA header style. */
export const FASTA_HEADER_LABELS: Record<ReferenceExportFastaHeader, string> = {
	accession: "Accession",
	full: "Accession, OTU, and isolate",
};

/** The labels a menu or settings page shows for each table format. */
export const TABLE_FORMAT_LABELS: Record<ReferenceExportTableFormat, string> = {
	csv: "CSV",
	tsv: "TSV",
};

/** The OTU fields an export reads, apart from its isolates. */
type ExportOtu = {
	/** The OTU name */
	name: string;

	/** The segments that order each isolate's sequences */
	schema: OtuSegment[];
};

/** A sequence with the names of the OTU and isolate it belongs to. */
type ExportSequence = OtuSequence & {
	/** The display name of the isolate */
	isolateName: string;

	/** The name of the OTU */
	otuName: string;
};

type Cell = string | number;

/**
 * Flatten isolates to their sequences, in isolate order and then segment
 * order, so an export reads the way the OTU detail page does.
 */
export function getExportSequences(
	otu: ExportOtu,
	isolates: OtuIsolate[],
): ExportSequence[] {
	return isolates.flatMap((isolate) => {
		const isolateName = formatIsolateName(isolate);

		return sortSequencesBySegment(isolate.sequences, otu.schema).map(
			(sequence) => ({ ...sequence, isolateName, otuName: otu.name }),
		);
	});
}

// A pipe or a line break in a name would open a field or an entry of its own,
// so each collapses to a space.
function sanitizeHeaderField(text: string): string {
	return text.replace(/[|\r\n]+/g, " ");
}

/**
 * Render sequences as FASTA, one unwrapped sequence line per entry.
 *
 * The `full` header is `>accession|otu|isolate`.
 */
export function formatFasta(
	sequences: ExportSequence[],
	header: ReferenceExportFastaHeader,
): string {
	return sequences
		.map((sequence) => {
			const fields =
				header === "full"
					? [sequence.accession, sequence.otuName, sequence.isolateName]
					: [sequence.accession];

			return `>${fields.map(sanitizeHeaderField).join("|")}\n${sequence.sequence}`;
		})
		.join("\n");
}

/** Render the accessions of sequences, one per line. */
export function formatAccessions(sequences: ExportSequence[]): string {
	return sequences.map((sequence) => sequence.accession).join("\n");
}

// Spreadsheets run a cell that begins with one of these characters as a
// formula, so free text that does is prefixed with a quote to keep it text.
const FORMULA_TRIGGER = /^[=+\-@\t\r]/;

function guardFormula(text: string): string {
	return FORMULA_TRIGGER.test(text) ? `'${text}` : text;
}

// TSV has no quoting convention that spreadsheets agree on, so a tab or line
// break in a field collapses to a space instead.
function toTsvField(value: Cell): string {
	if (typeof value === "number") {
		return String(value);
	}

	return guardFormula(value).replace(/[\t\r\n]+/g, " ");
}

// Every non-numeric field is quoted, numbers are written bare, and an embedded
// quote is doubled.
function toCsvField(value: Cell): string {
	if (typeof value === "number") {
		return String(value);
	}

	return `"${guardFormula(value).replaceAll('"', '""')}"`;
}

function formatTable(
	rows: Cell[][],
	format: ReferenceExportTableFormat,
): string {
	return rows
		.map((row) =>
			format === "csv"
				? row.map(toCsvField).join(",")
				: row.map(toTsvField).join("\t"),
		)
		.join("\n");
}

/** Render sequences as a table with a header row, one row per sequence. */
export function formatSequenceTable(
	sequences: ExportSequence[],
	format: ReferenceExportTableFormat,
): string {
	return formatTable(
		[
			[
				"OTU",
				"Isolate",
				"Accession",
				"Segment",
				"Length",
				"Definition",
				"Host",
			],
			...sequences.map((sequence) => [
				sequence.otuName,
				sequence.isolateName,
				sequence.accession,
				sequence.segment ?? "",
				sequence.sequence.length,
				sequence.definition,
				sequence.host,
			]),
		],
		format,
	);
}

/**
 * Render isolates as a table with a header row, one row per isolate.
 *
 * An isolate's accessions share one cell, in segment order.
 */
export function formatIsolateTable(
	otu: ExportOtu,
	isolates: OtuIsolate[],
	format: ReferenceExportTableFormat,
): string {
	return formatTable(
		[
			["OTU", "Isolate", "Default", "Sequences", "Accessions"],
			...isolates.map((isolate) => [
				otu.name,
				formatIsolateName(isolate),
				isolate.default ? "Yes" : "No",
				isolate.sequences.length,
				sortSequencesBySegment(isolate.sequences, otu.schema)
					.map((sequence) => sequence.accession)
					.join("; "),
			]),
		],
		format,
	);
}

// Browsers rewrite characters that are unsafe in a filename in different ways,
// so each run of them, whitespace, or underscores becomes one underscore.
const UNSAFE_FILENAME_CHARACTERS = /[\s\\/:*?"<>|_\p{Cc}]+/gu;

/**
 * A filename of the form `otu.isolate.kind.extension`, lower-cased with every
 * space and unsafe character replaced.
 */
export function formatExportFilename(parts: string[], extension: string) {
	return `${parts.join(".").replace(UNSAFE_FILENAME_CHARACTERS, "_")}.${extension}`.toLowerCase();
}

function describeShown(shown: number, total: number, noun: string): string {
	return shown === total
		? pluralize(total, noun)
		: `${shown} of ${pluralize(total, noun)}`;
}

/**
 * Describe the rows an export takes: the selection when there is one, else
 * every row the list shows.
 */
export function describeExportRows(
	selected: number,
	shown: number,
	total: number,
	noun: string,
): string {
	if (selected) {
		return `${pluralize(selected, noun)} selected`;
	}

	const count = describeShown(shown, total, noun);

	return shown === total ? `All ${count}` : count;
}

/** Describe a list's rows and its selection, for the list's header. */
export function describeSelection(
	selected: number,
	shown: number,
	total: number,
	noun: string,
): string {
	const count = describeShown(shown, total, noun);

	return selected ? `${selected} selected · ${count}` : count;
}
