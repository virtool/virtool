import type { WorkflowSettings } from "@virtool/contracts";
import { getSettings, type Settings } from "@virtool/data/settings/data";
import { requireJobRequest } from "../auth/guard";
import type { ReadHandlerDeps } from "../http";

/**
 * Map the settings singleton onto the wire.
 *
 * The two shapes agree field for field today. Writing the mapping out anyway
 * keeps the wire contract's spelling independent of the data layer's, which
 * `apps/web`'s administration pages also read.
 */
function toWorkflowSettings(settings: Settings): WorkflowSettings {
	return {
		defaultSourceTypes: settings.defaultSourceTypes,
		enableSentry: settings.enableSentry,
		minimumPasswordLength: settings.minimumPasswordLength,
		sampleAllRead: settings.sampleAllRead,
		sampleAllWrite: settings.sampleAllWrite,
		sampleGroup: settings.sampleGroup,
		sampleGroupRead: settings.sampleGroupRead,
		sampleGroupWrite: settings.sampleGroupWrite,
	};
}

/**
 * Serve the instance settings.
 *
 * There is no 404: the settings row is a singleton, and `getSettings` seeds the
 * defaults when it is absent. **That makes this read a write** on a database
 * that has never seen a Python boot — the one endpoint in this service where a
 * GET can insert a row. It mirrors Python's `SettingsData.ensure()`, and the
 * alternative is failing a workflow because nothing had written the row yet.
 */
export async function handleGetSettings(
	deps: ReadHandlerDeps,
	request: Request,
): Promise<Response> {
	const principal = await requireJobRequest(deps.db, request);

	if (principal instanceof Response) {
		return principal;
	}

	return Response.json(toWorkflowSettings(await getSettings(deps.db)));
}
