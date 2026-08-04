// FASTA downloads for an OTU, an isolate, or a single sequence.
//
// These are raw routes rather than server functions because the client reaches
// them with a plain `<a href>` — the browser has to see a real response carrying
// a `Content-Disposition`, which an RPC call cannot produce.
//
// Python serves these by sniffing a `.fa` suffix on the OTU and sequence *read*
// endpoints and branching inside the handler. That conflates two resources on
// one URL; here each is its own route ending in a `fasta` segment, and the
// filename lives in the `Content-Disposition` where it belongs.

import { formatIsolateName } from "@virtool/contracts";
import type { DbOrTx } from "@virtool/data/db/pg";
import { legacyOtus, legacySequences } from "@virtool/data/db/schema/otus";
import { and, eq, sql } from "drizzle-orm";
import { requireAuthenticatedRequest } from "../auth/middleware";
import { db } from "../composition";
import { contentDisposition, textResponse } from "../http";

const CONTENT_TYPE = "text/plain; charset=utf-8";

/**
 * One FASTA entry: a header naming the OTU, isolate, sequence and length,
 * followed by the sequence on its own line.
 */
function formatFastaEntry(
	otuName: string,
	isolateName: string,
	sequenceId: string,
	sequence: string,
): string {
	return `>${otuName}|${isolateName}|${sequenceId}|${sequence.length}\n${sequence}`;
}

/**
 * A filename of the form `otu.isolate.sequence_id.fa`, lower-cased with spaces
 * replaced.
 *
 * Python's `str.replace` substitutes every space; JavaScript's replaces only the
 * first, so this uses `replaceAll` — an OTU named "Squash browning spot virus"
 * would otherwise keep three of its spaces.
 */
function formatFastaFilename(...parts: string[]): string {
	return `${parts.join(".").replaceAll(" ", "_")}.fa`.toLowerCase();
}

// Only the sequence body is read out of the `data` JSONB. The metadata a FASTA
// export does not use stays in the column rather than crossing the wire, and a
// sequence body can run to many kilobytes.
function selectSequenceBodies(tx: DbOrTx) {
	return tx
		.select({
			id: legacySequences.id,
			isolateId: legacySequences.isolate_id,
			sequence: sql<string | null>`${legacySequences.data} ->> 'sequence'`,
		})
		.from(legacySequences);
}

type IsolateDocument = { id?: unknown; source_name?: unknown };

async function readOtu(
	tx: DbOrTx,
	otuId: string,
): Promise<{ name: string; isolates: IsolateDocument[] } | null> {
	const [row] = await tx
		.select({ name: legacyOtus.name, data: legacyOtus.data })
		.from(legacyOtus)
		.where(eq(legacyOtus.id, otuId))
		.limit(1);

	if (row === undefined) {
		return null;
	}

	const isolates = row.data.isolates;

	return {
		name: row.name,
		isolates: Array.isArray(isolates) ? (isolates as IsolateDocument[]) : [],
	};
}

/**
 * The OTU and isolate names a FASTA header and filename are built from, or
 * `null` when the OTU does not exist or carries no isolate with this id.
 *
 * Both misses collapse to one `null`: the isolate is addressed through the OTU,
 * so a caller who may not learn the OTU exists may not learn which of the two
 * was wrong either.
 */
async function readIsolateNames(
	tx: DbOrTx,
	otuId: string,
	isolateId: string,
): Promise<{ isolateName: string; otuName: string } | null> {
	const otu = await readOtu(tx, otuId);

	if (otu === null) {
		return null;
	}

	const isolate = otu.isolates.find(
		(candidate) => String(candidate.id) === isolateId,
	);

	if (isolate === undefined) {
		return null;
	}

	return { isolateName: formatIsolateName(isolate), otuName: otu.name };
}

/**
 * Serve every sequence in an OTU, grouped by isolate.
 *
 * Isolates are emitted in the order the document holds them and their sequences
 * in `position` order, so the export reads the way the OTU detail page does.
 */
export async function handleOtuFasta(
	request: Request,
	otuId: string,
): Promise<Response> {
	const session = await requireAuthenticatedRequest(request);

	if (session instanceof Response) {
		return session;
	}

	const otu = await readOtu(db, otuId);

	if (otu === null) {
		return textResponse("Not found", 404);
	}

	const rows = await selectSequenceBodies(db)
		.where(eq(legacySequences.otu_id, otuId))
		.orderBy(legacySequences.position);

	const byIsolate = new Map<string, typeof rows>();

	for (const row of rows) {
		const forIsolate = byIsolate.get(row.isolateId) ?? [];
		forIsolate.push(row);
		byIsolate.set(row.isolateId, forIsolate);
	}

	const entries = otu.isolates.flatMap((isolate) => {
		const isolateName = formatIsolateName(isolate);

		return (byIsolate.get(String(isolate.id)) ?? []).map((row) =>
			formatFastaEntry(otu.name, isolateName, row.id, row.sequence ?? ""),
		);
	});

	return fastaResponse(entries, formatFastaFilename(otu.name));
}

/** Serve every sequence belonging to one isolate. */
export async function handleIsolateFasta(
	request: Request,
	otuId: string,
	isolateId: string,
): Promise<Response> {
	const session = await requireAuthenticatedRequest(request);

	if (session instanceof Response) {
		return session;
	}

	const names = await readIsolateNames(db, otuId, isolateId);

	if (names === null) {
		return textResponse("Not found", 404);
	}

	const rows = await selectSequenceBodies(db)
		.where(
			and(
				eq(legacySequences.otu_id, otuId),
				eq(legacySequences.isolate_id, isolateId),
			),
		)
		.orderBy(legacySequences.position);

	const entries = rows.map((row) =>
		formatFastaEntry(
			names.otuName,
			names.isolateName,
			row.id,
			row.sequence ?? "",
		),
	);

	return fastaResponse(
		entries,
		formatFastaFilename(names.otuName, names.isolateName),
	);
}

/** Serve one sequence. */
export async function handleSequenceFasta(
	request: Request,
	otuId: string,
	isolateId: string,
	sequenceId: string,
): Promise<Response> {
	const session = await requireAuthenticatedRequest(request);

	if (session instanceof Response) {
		return session;
	}

	const [row] = await selectSequenceBodies(db)
		// Scoped to the OTU and isolate in the path rather than read by id alone,
		// so a sequence id that belongs to a different OTU cannot be exported
		// through this URL.
		.where(
			and(
				eq(legacySequences.id, sequenceId),
				eq(legacySequences.otu_id, otuId),
				eq(legacySequences.isolate_id, isolateId),
			),
		)
		.limit(1);

	if (row === undefined) {
		return textResponse("Not found", 404);
	}

	const names = await readIsolateNames(db, otuId, isolateId);

	if (names === null) {
		return textResponse("Not found", 404);
	}

	return fastaResponse(
		[
			formatFastaEntry(
				names.otuName,
				names.isolateName,
				row.id,
				row.sequence ?? "",
			),
		],
		formatFastaFilename(names.otuName, names.isolateName, sequenceId),
	);
}

function fastaResponse(entries: string[], filename: string): Response {
	return new Response(entries.join("\n"), {
		headers: {
			"content-disposition": contentDisposition(filename),
			"content-type": CONTENT_TYPE,
		},
	});
}
