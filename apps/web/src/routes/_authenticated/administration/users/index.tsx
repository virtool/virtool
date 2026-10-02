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
		const [{ usersQueryOptions }, { passwordPolicyQueryOptions }] =
			await Promise.all([
				import("@users/queries"),
				import("@administration/passwordPolicy"),
			]);

		return Promise.all([
			queryClient.ensureQueryData(
				usersQueryOptions({ ...deps, perPage: DEFAULT_PER_PAGE }),
			),
			// For the create-user form. Prefetched, not ensured: a failure here must
			// not take down the page.
			queryClient.prefetchQuery(passwordPolicyQueryOptions()),
		]);
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
