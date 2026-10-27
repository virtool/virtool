// Render a pathoscope analysis as a downloadable spreadsheet.

import type { JsonObject, PathoscopeColumn } from "@virtool/contracts";
import { formatAnalysis } from "@virtool/data/analyses/format";
import {
	asArray,
	asNumber,
	asRecord,
	asText,
} from "@virtool/data/analyses/json";
import type { DbOrTx } from "@virtool/data/db/pg";
import { median } from "es-toolkit";

type Cell = string | number;

/** The cells of a single spreadsheet row, grouped by the column they fill. */
type Row = Record<PathoscopeColumn, Cell[]>;

// The name column carries every field that identifies a row, so they move and
// stay together wherever it is placed.
const HEADERS: Row = {
	coverage: ["Coverage"],
	depth: ["Median Depth"],
	name: ["OTU", "Isolate", "Sequence", "Length"],
	weight: ["Weight"],
};

// Median depth per hit sequence, taken from the raw alignment before formatting
// replaces it with simplified coordinates. An absent or empty alignment reads
// as zero depth rather than failing the whole download.
function calculateMedianDepths(hits: unknown[]): Map<string, number> {
	const depths = new Map<string, number>();

	for (const entry of hits) {
		const hit = asRecord(entry);

		if (hit) {
			const align = asArray(hit.align).filter(
				(value): value is number => typeof value === "number",
			);

			depths.set(asText(hit.id), align.length > 0 ? median(align) : 0);
		}
	}

	return depths;
}

/** How an exported spreadsheet is laid out. */
type ExportOptions = {
	/** The columns to carry, in order */
	columns: PathoscopeColumn[];

	/** Whether to name an OTU by its acronym, when it has one */
	preferAcronym: boolean;
};

async function composeRows(
	db: DbOrTx,
	workflow: string,
	results: JsonObject,
	{ preferAcronym }: ExportOptions,
): Promise<Row[]> {
	const depths = calculateMedianDepths(asArray(results.hits));
	const formatted = await formatAnalysis(db, workflow, results);

	const rows: Row[] = [];

	for (const otuEntry of asArray(formatted.hits)) {
		const otu = asRecord(otuEntry);

		if (!otu) {
			continue;
		}

		const acronym = asText(otu.acronym);
		const otuName = preferAcronym && acronym ? acronym : asText(otu.name);

		for (const isolateEntry of asArray(otu.isolates)) {
			const isolate = asRecord(isolateEntry);

			if (!isolate) {
				continue;
			}

			for (const sequenceEntry of asArray(isolate.sequences)) {
				const sequence = asRecord(sequenceEntry);

				if (!sequence) {
					continue;
				}

				rows.push({
					coverage: [asNumber(sequence.coverage)],
					depth: [depths.get(asText(sequence.id)) ?? 0],
					name: [
						otuName,
						// Composed by the formatter, so the spreadsheet and the analysis
						// view cannot disagree about what an isolate is called.
						asText(isolate.name),
						asText(sequence.accession),
						asNumber(sequence.length),
					],
					weight: [asNumber(sequence.pi)],
				});
			}
		}
	}

	return rows;
}

function arrange(row: Row, columns: PathoscopeColumn[]): Cell[] {
	return columns.flatMap((column) => row[column]);
}

// Every non-numeric field is quoted, numbers are written bare, and an embedded
// quote is doubled.
function toCsvField(value: Cell): string {
	if (typeof value === "number") {
		return String(value);
	}

	return `"${value.replaceAll('"', '""')}"`;
}

function toCsvRow(row: Cell[]): string {
	return row.map(toCsvField).join(",");
}

/** Render a pathoscope analysis's results as CSV. */
export async function formatAnalysisToCsv(
	db: DbOrTx,
	workflow: string,
	results: JsonObject,
	options: ExportOptions,
): Promise<string> {
	const rows = await composeRows(db, workflow, results, options);

	// Every row is terminated with CRLF, including the last.
	return `${[HEADERS, ...rows]
		.map((row) => toCsvRow(arrange(row, options.columns)))
		.join("\r\n")}\r\n`;
}

/** Render a pathoscope analysis's results as an XLSX workbook. */
export async function formatAnalysisToExcel(
	db: DbOrTx,
	workflow: string,
	results: JsonObject,
	sampleId: number | null,
	options: ExportOptions,
): Promise<Uint8Array<ArrayBuffer>> {
	const rows = await composeRows(db, workflow, results, options);

	// Imported here rather than at module scope: the workbook writer is a large
	// dependency and only the xlsx branch of one download route needs it.
	const { Workbook } = await import("exceljs");

	const workbook = new Workbook();
	const sheet = workbook.addWorksheet(`Pathoscope for ${sampleId}`);

	const header = sheet.addRow(arrange(HEADERS, options.columns));
	header.font = { name: "Calibri", bold: true };

	for (const row of rows) {
		sheet.addRow(arrange(row, options.columns));
	}

	// `writeBuffer` is typed as exceljs's own Buffer alias; the bytes are a plain
	// ArrayBuffer, which is what a Response body needs.
	return new Uint8Array((await workbook.xlsx.writeBuffer()) as ArrayBuffer);
}
