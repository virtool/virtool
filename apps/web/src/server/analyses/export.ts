// Render a pathoscope analysis as a downloadable spreadsheet. Ported from
// `format_analysis_to_csv` and `format_analysis_to_excel` in
// `../../../../../virtool/virtool/analyses/format.py`.

import type { JsonObject } from "@virtool/contracts";
import { formatAnalysis } from "@virtool/data/analyses/format";
import {
	asArray,
	asNumber,
	asRecord,
	asText,
} from "@virtool/data/analyses/json";
import type { DbOrTx } from "@virtool/data/db/pg";
import { median } from "es-toolkit";

const HEADERS = [
	"OTU",
	"Isolate",
	"Sequence",
	"Length",
	"Weight",
	"Median Depth",
	"Coverage",
] as const;

/** A single spreadsheet row: the OTU and isolate names, then numeric metrics. */
type Row = [string, string, string, number, number, number, number];

// Median depth per hit sequence, taken from the raw alignment before formatting
// replaces it with simplified coordinates. Python reaches `statistics.median`
// here, which raises on an empty alignment; an absent one reads as zero depth
// rather than failing the whole download.
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

async function composeRows(
	db: DbOrTx,
	workflow: string,
	results: JsonObject,
): Promise<Row[]> {
	const depths = calculateMedianDepths(asArray(results.hits));
	const formatted = await formatAnalysis(db, workflow, results);

	const rows: Row[] = [];

	for (const otuEntry of asArray(formatted.hits)) {
		const otu = asRecord(otuEntry);

		if (!otu) {
			continue;
		}

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

				rows.push([
					asText(otu.name),
					// Composed by the formatter, so the spreadsheet and the analysis
					// view cannot disagree about what an isolate is called.
					asText(isolate.name),
					asText(sequence.accession),
					asNumber(sequence.length),
					asNumber(sequence.pi),
					depths.get(asText(sequence.id)) ?? 0,
					asNumber(sequence.coverage),
				]);
			}
		}
	}

	return rows;
}

// Python writes with `csv.QUOTE_NONNUMERIC`: every non-numeric field is quoted,
// numbers are written bare, and an embedded quote is doubled.
function toCsvField(value: string | number): string {
	if (typeof value === "number") {
		return String(value);
	}

	return `"${value.replaceAll('"', '""')}"`;
}

function toCsvRow(row: readonly (string | number)[]): string {
	return row.map(toCsvField).join(",");
}

/** Render a pathoscope analysis's results as CSV. */
export async function formatAnalysisToCsv(
	db: DbOrTx,
	workflow: string,
	results: JsonObject,
): Promise<string> {
	const rows = await composeRows(db, workflow, results);

	// Python's csv writer terminates every row with CRLF, including the last.
	return `${[HEADERS, ...rows].map(toCsvRow).join("\r\n")}\r\n`;
}

/** Render a pathoscope analysis's results as an XLSX workbook. */
export async function formatAnalysisToExcel(
	db: DbOrTx,
	workflow: string,
	results: JsonObject,
	sampleId: string,
): Promise<Uint8Array<ArrayBuffer>> {
	const rows = await composeRows(db, workflow, results);

	// Imported here rather than at module scope: the workbook writer is a large
	// dependency and only the xlsx branch of one download route needs it.
	const { Workbook } = await import("exceljs");

	const workbook = new Workbook();
	const sheet = workbook.addWorksheet(`Pathoscope for ${sampleId}`);

	const header = sheet.addRow([...HEADERS]);
	header.font = { name: "Calibri", bold: true };

	for (const row of rows) {
		sheet.addRow(row);
	}

	// `writeBuffer` is typed as exceljs's own Buffer alias; the bytes are a plain
	// ArrayBuffer, which is what a Response body needs.
	return new Uint8Array((await workbook.xlsx.writeBuffer()) as ArrayBuffer);
}
