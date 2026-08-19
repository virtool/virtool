import LoadingPlaceholder from "@base/LoadingPlaceholder";
import QueryError from "@base/QueryError";
import { useFetchLabels } from "@labels/queries";
import SampleFileManager from "@samples/components/SampleFileManager";
import type { SearchSchemaInput } from "@tanstack/react-router";
import { createFileRoute, stripSearchParams } from "@tanstack/react-router";
import {
	UPLOADS_SEARCH_DEFAULTS,
	type UploadsSearch,
	uploadsSearch,
} from "@uploads/search";

function validateSampleFilesSearch(
	input: Partial<UploadsSearch> & SearchSchemaInput,
): UploadsSearch {
	return uploadsSearch(input);
}

export const Route = createFileRoute("/_authenticated/samples/files")({
	validateSearch: validateSampleFilesSearch,
	// `validateSearch` puts every default back on the way in, so dropping them on
	// the way out keeps a shared link down to the params its sender changed.
	search: { middlewares: [stripSearchParams(UPLOADS_SEARCH_DEFAULTS)] },
	component: SampleFilesRoute,
});

function SampleFilesRoute() {
	const search = Route.useSearch();
	const navigate = Route.useNavigate();
	const { data: labels, isPending, isError } = useFetchLabels();

	if (isError && !labels) {
		return <QueryError noun="labels" />;
	}

	if (isPending) {
		return <LoadingPlaceholder />;
	}

	return (
		<SampleFileManager
			direction={search.direction}
			labels={labels}
			page={search.page}
			setPage={(page) => navigate({ search: { ...search, page } })}
			setSort={(sort, direction) =>
				navigate({ search: { ...search, direction, page: 1, sort } })
			}
			sort={search.sort}
		/>
	);
}
