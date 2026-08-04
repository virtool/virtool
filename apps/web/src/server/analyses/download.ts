import {
	AnalysisNotFoundError,
	getAnalysisForExport,
	getAnalysisSampleRights,
} from "@virtool/data/analyses/data";
import { hasSampleRight, resolveSampleActor } from "@virtool/data/samples/data";
import { requireAuthenticatedRequest } from "../auth/middleware";
import { db } from "../composition";
import { contentDisposition, textResponse } from "../http";
import { formatAnalysisToCsv, formatAnalysisToExcel } from "./export";

const CONTENT_TYPES = {
	csv: "text/csv",
	xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
} as const;

type Extension = keyof typeof CONTENT_TYPES;

function isExtension(value: string): value is Extension {
	return value in CONTENT_TYPES;
}

/**
 * Serve an analysis as a CSV or XLSX download, backing
 * `GET /analyses/documents/{id}.{extension}`.
 *
 * This is a raw route rather than a server function because the client reaches
 * it with a plain `<a href>` — the browser has to see a real response with a
 * `Content-Disposition`, which an RPC call cannot produce.
 *
 * Being a route means no policy middleware runs, so the authorization floor is
 * enforced here: a valid session, then the read right on the analysis's parent
 * sample, which is where an analysis's visibility comes from.
 */
export async function handleAnalysisDocument(
	request: Request,
	document: string,
): Promise<Response> {
	const session = await requireAuthenticatedRequest(request);
	if (session instanceof Response) {
		return session;
	}

	const separator = document.lastIndexOf(".");

	if (separator === -1) {
		return textResponse("Invalid document name", 400);
	}

	const analysisId = Number(document.slice(0, separator));
	const extension = document.slice(separator + 1);

	if (!Number.isInteger(analysisId) || analysisId <= 0) {
		return textResponse("Invalid analysis id", 400);
	}

	if (!isExtension(extension)) {
		return textResponse(`Invalid extension: ${extension}`, 400);
	}

	const rights = await getAnalysisSampleRights(db, analysisId);

	if (rights === null) {
		return textResponse("Not found", 404);
	}

	const actor = await resolveSampleActor(db, session.userId);

	if (!hasSampleRight(rights, actor, "read")) {
		return textResponse("Forbidden", 403);
	}

	let analysis: Awaited<ReturnType<typeof getAnalysisForExport>>;

	try {
		analysis = await getAnalysisForExport(db, analysisId);
	} catch (err) {
		if (err instanceof AnalysisNotFoundError) {
			return textResponse("Not found", 404);
		}
		throw err;
	}

	// An analysis that has not finished has no results to render.
	if (analysis.results === null) {
		return textResponse("Not found", 404);
	}

	const headers = {
		"content-disposition": contentDisposition(`${analysisId}.${extension}`),
		"content-type": CONTENT_TYPES[extension],
	};

	if (extension === "csv") {
		return new Response(
			await formatAnalysisToCsv(db, analysis.workflow, analysis.results),
			{ headers },
		);
	}

	return new Response(
		await formatAnalysisToExcel(
			db,
			analysis.workflow,
			analysis.results,
			analysis.sample,
		),
		{ headers },
	);
}
