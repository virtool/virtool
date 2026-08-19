import { SubtractionFileManager } from "@subtraction/components/SubtractionFileManager";
import type { SearchSchemaInput } from "@tanstack/react-router";
import { createFileRoute, stripSearchParams } from "@tanstack/react-router";
import {
	UPLOADS_SEARCH_DEFAULTS,
	type UploadsSearch,
	uploadsSearch,
} from "@uploads/search";

function validateSubtractionFilesSearch(
	input: Partial<UploadsSearch> & SearchSchemaInput,
): UploadsSearch {
	return uploadsSearch(input);
}

export const Route = createFileRoute("/_authenticated/subtractions/files")({
	validateSearch: validateSubtractionFilesSearch,
	// `validateSearch` puts every default back on the way in, so dropping them on
	// the way out keeps a shared link down to the params its sender changed.
	search: { middlewares: [stripSearchParams(UPLOADS_SEARCH_DEFAULTS)] },
	component: SubtractionFilesRoute,
});

function SubtractionFilesRoute() {
	const search = Route.useSearch();
	const navigate = Route.useNavigate();

	return (
		<SubtractionFileManager
			direction={search.direction}
			page={search.page}
			setPage={(page) => navigate({ search: { ...search, page } })}
			setSort={(sort, direction) =>
				navigate({ search: { ...search, direction, page: 1, sort } })
			}
			sort={search.sort}
		/>
	);
}
