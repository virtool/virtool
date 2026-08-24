import { useCheckAdminRole } from "@administration/hooks";
import Alert from "@base/Alert";
import LoadingPlaceholder from "@base/LoadingPlaceholder";
import QueryError from "@base/QueryError";
import SearchToolbar from "@base/SearchToolbar";
import { ToggleGroup, ToggleGroupItem } from "@base/Toggle";
import { CircleAlert } from "lucide-react";
import CreateUser from "./CreateUser";
import UsersList from "./UsersList";

type ManageUsersProps = {
	page?: number;
	setSearch?: (
		next: { page?: number; status?: string; term?: string },
		options?: { replace?: boolean },
	) => void;
	status?: string;
	term?: string;
};

/**
 * Displays a list of editable users and tools for sorting through and creating users
 */
export function ManageUsers({
	page = 1,
	setSearch = () => {},
	status = "active",
	term = "",
}: ManageUsersProps) {
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
				<SearchToolbar
					aria-label="Search users"
					onChange={(term) => setSearch({ term, page: 1 }, { replace: true })}
					placeholder="Username"
					value={term}
				>
					<ToggleGroup
						value={status}
						onValueChange={(status) => setSearch({ status })}
					>
						<ToggleGroupItem value="active">Active</ToggleGroupItem>
						<ToggleGroupItem value="deactivated">Deactivated</ToggleGroupItem>
					</ToggleGroup>
					<CreateUser />
				</SearchToolbar>

				<UsersList
					page={page}
					setPage={(page) => setSearch({ page })}
					status={status}
					term={term}
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
