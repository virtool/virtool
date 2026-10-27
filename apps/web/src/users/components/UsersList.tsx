import { BoxGroup, BoxGroupTable } from "@base/Box";
import ListEmpty from "@base/ListEmpty";
import ListHeader from "@base/ListHeader";
import Pagination from "@base/Pagination";
import { nextSortDirection } from "@base/sorting";
import { type AdministeredUsersQuery, useSuspenseUsers } from "@users/queries";
import type { UserSortField } from "@virtool/contracts";
import { SearchX } from "lucide-react";
import { UserItem } from "./UserItem";
import UserTableHead from "./UserTableHead";

type UsersListProps = {
	/** The filters, ordering, and page of the list */
	query: AdministeredUsersQuery;

	setPage: (page: number) => void;

	/** Sorts the list by a column, in the given direction */
	setSort: (
		sort: UserSortField,
		direction: AdministeredUsersQuery["direction"],
	) => void;
};

/**
 * A paginated, sortable table of users
 */
export default function UsersList({ query, setPage, setSort }: UsersListProps) {
	const { data } = useSuspenseUsers(query);
	const { foundCount, items, page, pageCount } = data;

	if (!items.length) {
		return (
			<ListEmpty
				icon={SearchX}
				title="No users found"
				description="No users match the current search and filters."
			/>
		);
	}

	return (
		<Pagination
			storedPage={page}
			currentPage={query.page}
			pageCount={pageCount}
			onPageChange={setPage}
		>
			<BoxGroup>
				<ListHeader
					label={`${foundCount} ${foundCount === 1 ? "user" : "users"}`}
				/>
				<BoxGroupTable variant="data">
					<UserTableHead
						direction={query.direction}
						onSort={(field) =>
							setSort(
								field,
								nextSortDirection(field, query.sort, query.direction),
							)
						}
						sort={query.sort}
					/>
					<tbody>
						{items.map((user) => (
							<UserItem key={user.id} user={user} />
						))}
					</tbody>
				</BoxGroupTable>
			</BoxGroup>
		</Pagination>
	);
}
