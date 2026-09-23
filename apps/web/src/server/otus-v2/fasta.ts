import {
	getV2FastaPage,
	hasV2FastaScope,
	type V2FastaScope,
	type V2FastaSequence,
} from "@virtool/data/otus-v2/fasta";
import { resolveReferenceActor } from "@virtool/data/references/data";
import {
	checkReferenceV2Visibility,
	getReferenceV2,
	ReferenceV2NotFoundError,
} from "@virtool/data/references-v2/data";
import { z } from "zod";
import { requireAuthenticatedRequest } from "../auth/middleware";
import { db } from "../composition";
import { contentDisposition, textResponse } from "../http";

const scopeSchema = z.object({
	referenceId: z.uuid(),
	otuId: z.uuid().optional(),
	isolateId: z.uuid().optional(),
});
const PAGE_SIZE = 32;

function formatEntry(row: V2FastaSequence): string {
	const header = `>virtool:v2|reference=${row.referenceId}|otu=${row.otuId}|isolate=${row.isolateId}|sequence=${row.sequenceId}|segment=${row.segmentId}|source=${row.source}`;
	return `${header}${row.accessionVersion ? `|accession=${row.accessionVersion}` : ""}\n${row.sequence}\n`;
}

function streamFasta(scope: V2FastaScope): ReadableStream<Uint8Array> {
	const encoder = new TextEncoder();
	const rows: V2FastaSequence[] = [];
	const state = { after: null as string | null, done: false };
	return new ReadableStream({
		async pull(controller) {
			if (rows.length === 0 && !state.done) {
				const page = await getV2FastaPage(db, scope, state.after, PAGE_SIZE);
				rows.push(...page);
				state.done = page.length < PAGE_SIZE;
			}
			const row = rows.shift();
			if (!row) {
				controller.close();
				return;
			}
			state.after = row.sequenceId;
			controller.enqueue(encoder.encode(formatEntry(row)));
		},
	});
}

/** Serve current v2 Reference, OTU, or isolate sequences as a streamed FASTA. */
export async function handleV2Fasta(
	request: Request,
	input: V2FastaScope,
): Promise<Response> {
	const session = await requireAuthenticatedRequest(request);
	if (session instanceof Response) {
		return session;
	}
	const parsed = scopeSchema.safeParse(input);
	if (!parsed.success || (input.isolateId && !input.otuId)) {
		return textResponse("Invalid export path", 400);
	}
	const scope = parsed.data;
	const actor = await resolveReferenceActor(db, session.userId);
	if (!(await checkReferenceV2Visibility(db, scope.referenceId, actor))) {
		return textResponse("Not found", 404);
	}
	try {
		await getReferenceV2(db, scope.referenceId);
	} catch (error) {
		if (error instanceof ReferenceV2NotFoundError) {
			return textResponse("Not found", 404);
		}
		throw error;
	}
	if (!(await hasV2FastaScope(db, scope))) {
		return textResponse("Not found", 404);
	}
	const filename = `reference-${scope.referenceId}${scope.otuId ? `.otu-${scope.otuId}` : ""}${scope.isolateId ? `.isolate-${scope.isolateId}` : ""}.fa`;
	return new Response(streamFasta(scope), {
		headers: {
			"cache-control": "private, no-store",
			"content-type": "text/plain; charset=utf-8",
			"content-disposition": contentDisposition(filename),
		},
	});
}
