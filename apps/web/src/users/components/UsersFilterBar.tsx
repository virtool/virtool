import {
	FilterBar,
	FilterChip,
	FilterGroup,
	FilterMenuCheckboxItem,
	FilterMenuContent,
} from "@base/Filter";
import { userRoleDisplayNames, userStatusDisplayNames } from "@users/utils";
import {
	USER_ROLE_FILTERS,
	USER_STATUSES,
	type UserRoleFilter,
	type UserStatus,
} from "@virtool/contracts";
import { CircleDot, Search, ShieldUser } from "lucide-react";

type UsersFilterBarProps = {
	/** Clears the search term. */
	onClearTerm: () => void;

	/** Replaces the selected roles. */
	onChangeRoles: (roles: UserRoleFilter[]) => void;

	/** Replaces the selected account states. */
	onChangeStatuses: (statuses: UserStatus[]) => void;

	/** The selected roles. */
	roles: UserRoleFilter[];

	/** The selected account states. */
	statuses: UserStatus[];

	/** The active search term. */
	term: string;
};

function toggle<T>(values: T[], value: T): T[] {
	return values.includes(value)
		? values.filter((item) => item !== value)
		: [...values, value];
}

/**
 * The filters of the users table, each showing chips for its active filters
 */
export default function UsersFilterBar({
	onChangeRoles,
	onChangeStatuses,
	onClearTerm,
	roles,
	statuses,
	term,
}: UsersFilterBarProps) {
	return (
		<FilterBar className="mb-3" label="Filters">
			{term && (
				<FilterGroup icon={<Search size={14} />} title="Search">
					<FilterChip onRemove={onClearTerm} removeLabel="Clear search term">
						{term}
					</FilterChip>
				</FilterGroup>
			)}
			<FilterGroup
				icon={<ShieldUser size={14} />}
				menu={
					<FilterMenuContent
						onClear={() => onChangeRoles([])}
						showClear={roles.length > 0}
					>
						{USER_ROLE_FILTERS.map((role) => (
							<FilterMenuCheckboxItem
								checked={roles.includes(role)}
								key={role}
								onCheckedChange={() => onChangeRoles(toggle(roles, role))}
							>
								{userRoleDisplayNames[role]}
							</FilterMenuCheckboxItem>
						))}
					</FilterMenuContent>
				}
				title="Role"
			>
				{roles.map((role) => (
					<FilterChip
						key={role}
						onRemove={() => onChangeRoles(toggle(roles, role))}
						removeLabel={`Remove ${userRoleDisplayNames[role]} role filter`}
					>
						{userRoleDisplayNames[role]}
					</FilterChip>
				))}
			</FilterGroup>
			<FilterGroup
				icon={<CircleDot size={14} />}
				menu={
					<FilterMenuContent
						onClear={() => onChangeStatuses([])}
						showClear={statuses.length > 0}
					>
						{USER_STATUSES.map((status) => (
							<FilterMenuCheckboxItem
								checked={statuses.includes(status)}
								key={status}
								onCheckedChange={() =>
									onChangeStatuses(toggle(statuses, status))
								}
							>
								{userStatusDisplayNames[status]}
							</FilterMenuCheckboxItem>
						))}
					</FilterMenuContent>
				}
				title="Status"
			>
				{statuses.map((status) => (
					<FilterChip
						key={status}
						onRemove={() => onChangeStatuses(toggle(statuses, status))}
						removeLabel={`Remove ${userStatusDisplayNames[status]} status filter`}
					>
						{userStatusDisplayNames[status]}
					</FilterChip>
				))}
			</FilterGroup>
		</FilterBar>
	);
}
