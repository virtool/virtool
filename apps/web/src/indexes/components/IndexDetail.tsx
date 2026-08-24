import { ContainerNarrow } from "@base/Container";
import LoadingPlaceholder from "@base/LoadingPlaceholder";
import NotFound from "@base/NotFound";
import RelativeTime from "@base/RelativeTime";
import {
	SubviewHeader,
	SubviewHeaderAttribution,
	SubviewHeaderTitle,
} from "@base/Subview";
import { useFetchReference } from "@references/queries";
import { getRouteApi } from "@tanstack/react-router";
import { useFetchIndex } from "../queries";
import Contributors from "./Contributors";
import Files from "./IndexFiles";
import IndexOTUs from "./IndexOTUs";

const routeApi = getRouteApi("/_authenticated/refs/$refId/indexes/$indexId");

/**
 * The index detailed view
 */
export default function IndexDetail() {
	const { indexId, refId } = routeApi.useParams();
	const {
		data: index,
		isPending: isPendingIndex,
		isError,
	} = useFetchIndex(Number(indexId));
	const {
		data: reference,
		isPending: isPendingReference,
		isError: isErrorReference,
	} = useFetchReference(Number(refId));

	if ((isError && !index) || (isErrorReference && !reference)) {
		return <NotFound />;
	}
	if (isPendingIndex || isPendingReference) {
		return <LoadingPlaceholder />;
	}

	const { contributors, createdAt, files, otus, user, version } = index;

	return (
		<>
			<SubviewHeader>
				<SubviewHeaderTitle>Index {version}</SubviewHeaderTitle>
				<div className="flex items-center">
					<SubviewHeaderAttribution>
						{user.handle} built <RelativeTime time={createdAt} />
					</SubviewHeaderAttribution>
				</div>
			</SubviewHeader>

			<ContainerNarrow>
				<Contributors contributors={contributors} />
				<Files files={files} />
				<IndexOTUs otus={otus} refId={refId} />
			</ContainerNarrow>
		</>
	);
}
