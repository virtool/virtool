import { useFuse } from "@app/fuse";
import BoxGroup from "@base/BoxGroup";
import BoxGroupSection from "@base/BoxGroupSection";
import ComboBox from "@base/ComboBox";
import Icon from "@base/Icon";
import Link from "@base/Link";
import LoadingPlaceholder from "@base/LoadingPlaceholder";
import QueryError from "@base/QueryError";
import { RadioGroup, RadioGroupItem } from "@base/RadioGroup";
import { useListGroups } from "@groups/queries";
import { useUpdateUser } from "@users/queries";
import type { GroupMinimal } from "@virtool/contracts";
import { X } from "lucide-react";

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
 *
 * A single-select combobox adds groups to the membership list. Each member is
 * a row in a radio group that selects the primary group, with a button to
 * revoke membership.
 */
export default function UserGroups({
	memberGroups,
	primaryGroup,
	userId,
}: UserGroupsProps) {
	const { data, isPending, isError } = useListGroups();
	const mutation = useUpdateUser();

	const [results, term, setTerm] = useFuse<GroupMinimal>(data ?? NO_GROUPS, [
		"name",
	]);

	const memberIds = new Set(memberGroups.map((group) => group.id));
	const availableGroups = results.filter((group) => !memberIds.has(group.id));

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
				groups: [...memberIds].filter((memberId) => memberId !== id),
				...(primaryGroup?.id === id ? { primaryGroup: null } : {}),
			},
		});
	}

	function setPrimaryGroup(value: string) {
		mutation.mutate({
			userId,
			update: { primaryGroup: value === "none" ? null : Number(value) },
		});
	}

	function renderAdd() {
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

		if (availableGroups.length === 0) {
			return (
				<p className="text-gray-500">This user is a member of every group.</p>
			);
		}

		return (
			<ComboBox<GroupMinimal>
				label="Add group"
				hideLabel
				items={availableGroups}
				selectedItem={null}
				onChange={(group) => {
					addGroup(group.id);
					setTerm("");
				}}
				term={term}
				onTermChange={setTerm}
				itemToKey={(group) => String(group.id)}
				itemToString={(group) => group.name}
				renderOption={(group) => (
					<span className="capitalize">{group.name}</span>
				)}
				placeholder="Add group"
			/>
		);
	}

	function renderMembership() {
		if (memberGroups.length) {
			return (
				<RadioGroup
					className="mt-4"
					aria-label="Primary group"
					value={primaryGroup ? String(primaryGroup.id) : "none"}
					onValueChange={setPrimaryGroup}
				>
					<BoxGroup>
						{memberGroups.map((group) => (
							<BoxGroupSection
								key={group.id}
								className="flex items-center gap-3"
							>
								<RadioGroupItem
									id={`primary-${group.id}`}
									value={String(group.id)}
								/>
								<label
									htmlFor={`primary-${group.id}`}
									className="grow capitalize cursor-pointer select-none"
								>
									{group.name}
								</label>
								<button
									type="button"
									aria-label={`Remove ${group.name}`}
									className="text-gray-500 hover:text-gray-800"
									onClick={() => removeGroup(group.id)}
								>
									<Icon icon={X} />
								</button>
							</BoxGroupSection>
						))}
						<BoxGroupSection className="flex items-center gap-3">
							<RadioGroupItem id="primary-none" value="none" />
							<label
								htmlFor="primary-none"
								className="grow cursor-pointer select-none"
							>
								No primary group
							</label>
						</BoxGroupSection>
					</BoxGroup>
				</RadioGroup>
			);
		}

		// When no groups exist at all, renderAdd already explains the situation.
		if (data?.length === 0) {
			return null;
		}

		return (
			<p className="mt-4 text-gray-500">
				This user is not a member of any groups.
			</p>
		);
	}

	return (
		<div className="mb-4">
			<span className="font-medium mb-2 inline-block">Groups</span>
			{renderAdd()}
			{renderMembership()}
		</div>
	);
}
