import { DEFAULT_PER_PAGE, paginated } from "@app/pagination";
import { oneOf, oneOfArray, str } from "@app/searchParams";
import type { SearchSchemaInput } from "@tanstack/react-router";
import { createFileRoute } from "@tanstack/react-router";
import {
	ManageUsers,
	type ManageUsersSearch,
} from "@users/components/ManageUsers";
import {
	SORT_DIRECTIONS,
	USER_ROLE_FILTERS,
	USER_SORT_FIELDS,
	USER_STATUSES,
} from "@virtool/contracts";

function validateUsersSearch(
	input: Partial<ManageUsersSearch> & SearchSchemaInput,
): ManageUsersSearch {
	return {
		...paginated(input),
		direction: oneOf(input.direction, SORT_DIRECTIONS, "ascending"),
		roles: oneOfArray(input.roles, USER_ROLE_FILTERS, []),
		sort: oneOf(input.sort, USER_SORT_FIELDS, "handle"),
		statuses: oneOfArray(input.statuses, USER_STATUSES, []),
		term: str(input.term, ""),
	};
}

export const Route = createFileRoute("/_authenticated/administration/users/")({
	validateSearch: validateUsersSearch,
	loaderDeps: ({ search }) => search,
	loader: async ({ context: { queryClient }, deps }) => {
		const { usersQueryOptions } = await import("@users/queries");
		return queryClient.ensureQueryData(
			usersQueryOptions({ ...deps, perPage: DEFAULT_PER_PAGE }),
		);
	},
	component: UsersRoute,
});

function UsersRoute() {
	const search = Route.useSearch();
	const navigate = Route.useNavigate();

	return (
		<ManageUsers
			perPage={DEFAULT_PER_PAGE}
			search={search}
			setSearch={(next, options) =>
				navigate({
					search: { ...search, ...next },
					replace: options?.replace,
				})
			}
		/>
	);
}
