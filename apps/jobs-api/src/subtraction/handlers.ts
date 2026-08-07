import { FinalizeSubtractionRequest } from "@virtool/contracts";
import type { Db } from "@virtool/data/db/pg";
import type { SubtractionFileType } from "@virtool/data/db/schema/subtractions";
import {
	finalizeSubtraction,
	SubtractionAlreadyFinalizedError,
	SubtractionNotFoundError,
} from "@virtool/data/subtraction/data";
import type { Logger } from "@virtool/logger";
import type { StorageBackend } from "@virtool/storage";
import { requireJobRequest } from "../auth/guard";
import { jsonError, parseRowId } from "../http";
import { checkManifest, measureManifest } from "../manifest";

/** What the subtraction handlers need to serve a request. */
export type SubtractionHandlerDeps = {
	db: Db;
	storage: StorageBackend;
	logger: Logger;
};

/**
 * The only filenames a subtraction accepts, matching Python's
 * `virtool/subtractions/utils.py:FILES`.
 *
 * Python addresses a subtraction file by `name` in the URL of its download
 * endpoint, so this is what keeps that URL space closed. It is no longer doing
 * duty as key safety — the key is checked against the subtraction's own prefix.
 */
const FILE_NAMES = [
	"subtraction.fa.gz",
	"subtraction.1.bt2",
	"subtraction.2.bt2",
	"subtraction.3.bt2",
	"subtraction.4.bt2",
	"subtraction.rev.1.bt2",
	"subtraction.rev.2.bt2",
] as const;

/**
 * The type column follows from the extension, as it does in Python's
 * `check_subtraction_file_type`.
 *
 * Derived rather than declared: with the name whitelisted there is nothing for a
 * caller to decide, and a wire field would only let a `.bt2` shard be recorded
 * as the FASTA.
 */
function fileType(name: string): SubtractionFileType {
	return name.endsWith(".fa.gz") ? "fasta" : "bowtie2";
}

/**
 * Finalize a subtraction: record what the create_subtraction job produced and
 * flip it ready.
 *
 * Every object the manifest names is measured before any row is written, and the
 * rows carry those measurements rather than anything the caller declared.
 */
export async function handleFinalizeSubtraction(
	deps: SubtractionHandlerDeps,
	request: Request,
	subtractionIdParam: string,
): Promise<Response> {
	const principal = await requireJobRequest(deps.db, request);

	if (principal instanceof Response) {
		return principal;
	}

	const subtractionId = parseRowId(subtractionIdParam);

	if (subtractionId === null) {
		return jsonError(404, "Subtraction not found");
	}

	let body: unknown;

	try {
		body = await request.json();
	} catch {
		return jsonError(400, "Malformed body");
	}

	const parsed = FinalizeSubtractionRequest.safeParse(body);

	if (!parsed.success) {
		return Response.json(
			{ message: "Invalid body", errors: parsed.error.issues },
			{ status: 400 },
		);
	}

	const { count, gc, files } = parsed.data;

	const invalid = checkManifest(
		files,
		`subtractions/${subtractionId}/`,
		FILE_NAMES,
	);

	if (invalid) {
		return jsonError(400, invalid);
	}

	const measured = await measureManifest(deps.storage, files);

	if (measured === null) {
		return jsonError(400, "A manifest entry names no stored object");
	}

	try {
		const subtraction = await finalizeSubtraction(deps.db, subtractionId, {
			count,
			gc,
			files: measured.map((file) => ({
				name: file.name,
				type: fileType(file.name),
				size: file.size,
				storageKey: file.storageKey,
			})),
		});

		deps.logger.info(
			{ jobId: principal.jobId, subtractionId, files: files.length },
			"finalized subtraction",
		);

		return Response.json(subtraction);
	} catch (err) {
		if (err instanceof SubtractionNotFoundError) {
			return jsonError(404, "Subtraction not found");
		}

		if (err instanceof SubtractionAlreadyFinalizedError) {
			return jsonError(409, "Subtraction has already been finalized");
		}

		throw err;
	}
}
