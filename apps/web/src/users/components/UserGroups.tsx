import Link from "@base/Link";
import LoadingPlaceholder from "@base/LoadingPlaceholder";
import QueryError from "@base/QueryError";
import SectionHeader from "@base/SectionHeader";
import { useListGroups } from "@groups/queries";
import { useUpdateUser } from "@users/queries";
import type { GroupMinimal } from "@virtool/contracts";
import GroupMembershipField from "./GroupMembershipField";

/** A stable empty fallback so `useFuse` doesn't reset its term while loading */
const NO_GROUPS: GroupMinimal[] = [];

type UserGroupsProps = {
	/** The groups the user is a member of */
	memberGroups: GroupMinimal[];

	/** The user's primary group, or null if none */
	primaryGroup: GroupMinimal | null;

	/** The unique user id */
	userId: number;
};

/**
 * Manages a user's group membership and primary group.
 */
export default function UserGroups({
	memberGroups,
	primaryGroup,
	userId,
}: UserGroupsProps) {
	const { data, isPending, isError } = useListGroups();
	const mutation = useUpdateUser();

	const memberIds = memberGroups.map((group) => group.id);

	function addGroup(id: number) {
		mutation.mutate({
			userId,
			update: { groups: [...memberIds, id] },
		});
	}

	function removeGroup(id: number) {
		mutation.mutate({
			userId,
			update: {
				groups: memberIds.filter((memberId) => memberId !== id),
				...(primaryGroup?.id === id ? { primaryGroup: null } : {}),
			},
		});
	}

	function setPrimaryGroup(id: number | null) {
		mutation.mutate({
			userId,
			update: { primaryGroup: id },
		});
	}

	function renderAddPlaceholder() {
		if (isError && !data) {
			return <QueryError noun="groups" />;
		}

		if (isPending) {
			return <LoadingPlaceholder />;
		}

		if (data.length === 0) {
			return (
				<p className="text-gray-500">
					No groups have been created yet.{" "}
					<Link
						to="/administration/groups"
						className="text-blue-600 hover:underline"
					>
						Manage groups
					</Link>
					.
				</p>
			);
		}

		return null;
	}

	function renderContent() {
		const addPlaceholder = renderAddPlaceholder();

		if (data?.length === 0 && memberGroups.length === 0) {
			return addPlaceholder;
		}

		return (
			<GroupMembershipField
				groups={data ?? NO_GROUPS}
				memberGroups={memberGroups}
				primaryGroupId={primaryGroup?.id ?? null}
				onAdd={addGroup}
				onRemove={removeGroup}
				onPrimaryGroupChange={setPrimaryGroup}
				addPlaceholder={addPlaceholder}
			/>
		);
	}

	return (
		<div className="mb-4">
			<SectionHeader level={3}>
				<h3>Groups</h3>
			</SectionHeader>
			{renderContent()}
		</div>
	);
}
