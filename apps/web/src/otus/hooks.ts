import { getRouteApi } from "@tanstack/react-router";
import type { Otu } from "@virtool/contracts";

const routeApi = getRouteApi(
	"/_authenticated/refs/$refId/otus/$otuId/isolates/$isolateId",
);

/**
 * A hook to get the active isolate id
 *
 * @param otu - The OTU to get the isolate id from
 * @returns The unique identifier of the active isolate
 */
export function useGetActiveIsolateId(otu: Otu) {
	const { isolateId } = routeApi.useParams();
	const hasIsolate = otu.isolates.some((isolate) => isolate.id === isolateId);
	return hasIsolate ? isolateId : otu.isolates[0]?.id;
}
