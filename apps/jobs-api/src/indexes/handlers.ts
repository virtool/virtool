import type { Index, WorkflowIndex } from "@virtool/contracts";
import { getIndex, IndexNotFoundError } from "@virtool/data/indexes/data";
import { requireJobRequest } from "../auth/guard";
import { jsonError, type ReadHandlerDeps, requireRowId } from "../http";

/**
 * Narrow an index build to what a workflow reads.
 *
 * The mapping happens here rather than inside `@virtool/data`, which returns
 * this shape to `apps/web`'s client as well — including the contributor and OTU
 * lists a build page shows and the `downloadUrl` that has no meaning to a
 * workflow.
 *
 * Each file carries its recorded `storageKey`; the workflow takes it to the
 * bucket itself.
 */
function toWorkflowIndex(index: Index): WorkflowIndex {
	return {
		id: index.id,
		files: index.files.map((file) => ({
			id: file.id,
			name: file.name,
			size: file.size,
			storageKey: file.storageKey,
			type: file.type,
		})),
		manifest: index.manifest,
		ready: index.ready,
		reference: { id: index.reference.id, name: index.reference.name },
		version: index.version,
	};
}

/**
 * Serve an index build's metadata, its manifest, and the files it produced.
 *
 * Records only. **This read must never build anything.** Python's `create_index`
 * task writes a build's artifacts eagerly — this side stops at inserting the row
 * that task claims — so a build whose files are not there yet answers with the
 * rows that exist rather than generating the ones that do not.
 */
export async function handleGetIndex(
	deps: ReadHandlerDeps,
	request: Request,
	indexIdParam: string,
): Promise<Response> {
	const principal = await requireJobRequest(deps.db, request);

	if (principal instanceof Response) {
		return principal;
	}

	const indexId = requireRowId(indexIdParam, "Index not found");

	if (indexId instanceof Response) {
		return indexId;
	}

	try {
		return Response.json(toWorkflowIndex(await getIndex(deps.db, indexId)));
	} catch (err) {
		if (err instanceof IndexNotFoundError) {
			return jsonError(404, "Index not found");
		}

		throw err;
	}
}
