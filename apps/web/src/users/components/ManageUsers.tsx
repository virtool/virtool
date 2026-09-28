import { useCheckAdminRole } from "@administration/hooks";
import Alert from "@base/Alert";
import LoadingPlaceholder from "@base/LoadingPlaceholder";
import QueryError from "@base/QueryError";
import SearchToolbar from "@base/SearchToolbar";
import SectionHeader from "@base/SectionHeader";
import type { AdministeredUsersQuery } from "@users/queries";
import { CircleAlert } from "lucide-react";
import CreateUser from "./CreateUser";
import UsersFilterBar from "./UsersFilterBar";
import UsersList from "./UsersList";

/** The URL-backed state of the user administration list. */
export type ManageUsersSearch = Omit<AdministeredUsersQuery, "perPage">;

type ManageUsersProps = {
	/** The number of users on each page */
	perPage: number;

	search: ManageUsersSearch;

	setSearch: (
		next: Partial<ManageUsersSearch>,
		options?: { replace?: boolean },
	) => void;
};

/**
 * Displays a list of editable users and tools for sorting through and creating users
 */
export function ManageUsers({ perPage, search, setSearch }: ManageUsersProps) {
	const { hasPermission, isError, isPending } = useCheckAdminRole("users");

	if (isError && hasPermission === null) {
		return <QueryError noun="users" />;
	}

	if (isPending) {
		return <LoadingPlaceholder />;
	}

	if (hasPermission) {
		return (
			<>
				<SectionHeader>
					<h2>Users</h2>
					<p>Manage user accounts and access.</p>
				</SectionHeader>
				<SearchToolbar
					aria-label="Search users"
					onChange={(term) => setSearch({ term, page: 1 }, { replace: true })}
					placeholder="Handle or email"
					value={search.term}
				>
					<CreateUser />
				</SearchToolbar>
				<UsersFilterBar
					onChangeRoles={(roles) => setSearch({ roles, page: 1 })}
					onChangeStatuses={(statuses) => setSearch({ statuses, page: 1 })}
					onClearTerm={() => setSearch({ term: "", page: 1 })}
					roles={search.roles}
					statuses={search.statuses}
					term={search.term}
				/>
				<UsersList
					query={{ ...search, perPage }}
					setPage={(page) => setSearch({ page })}
					setSort={(sort, direction) => setSearch({ sort, direction, page: 1 })}
				/>
			</>
		);
	}

	return (
		<Alert color="orange" level>
			<CircleAlert />
			<span>
				<strong>You do not have permission to manage users.</strong>
				<span> Contact an administrator.</span>
			</span>
		</Alert>
	);
}
