import type { Reference, WorkflowReference } from "@virtool/contracts";
import {
	getReference,
	ReferenceNotFoundError,
} from "@virtool/data/references/data";
import { requireJobRequest } from "../auth/guard";
import { jsonError, type ReadHandlerDeps, requireRowId } from "../http";

/**
 * Narrow a reference to what a workflow reads.
 *
 * The rights lists, contributors and build history the SPA shows are about who
 * may edit a reference, which is not a question a workflow asks. Dropping them
 * also keeps the `Date` values in those shapes off this wire, where they would
 * serialize to strings the declared type does not describe.
 */
function toWorkflowReference(reference: Reference): WorkflowReference {
	return {
		id: reference.id,
		dataType: reference.dataType,
		description: reference.description,
		name: reference.name,
		organism: reference.organism,
	};
}

/**
 * Serve a reference's metadata.
 *
 * The path is `/refs/{id}`, matching Python's resource path for this domain
 * rather than the spelled-out `/references` the package name would suggest.
 */
export async function handleGetReference(
	deps: ReadHandlerDeps,
	request: Request,
	referenceIdParam: string,
): Promise<Response> {
	const principal = await requireJobRequest(deps.db, request);

	if (principal instanceof Response) {
		return principal;
	}

	const referenceId = requireRowId(referenceIdParam, "Reference not found");

	if (referenceId instanceof Response) {
		return referenceId;
	}

	try {
		return Response.json(
			toWorkflowReference(await getReference(deps.db, referenceId)),
		);
	} catch (err) {
		if (err instanceof ReferenceNotFoundError) {
			return jsonError(404, "Reference not found");
		}

		throw err;
	}
}
