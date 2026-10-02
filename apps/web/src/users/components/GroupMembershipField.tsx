import { useFuse } from "@app/fuse";
import { BoxGroup, BoxGroupSection } from "@base/Box";
import { ButtonToggle } from "@base/Button";
import ComboBox from "@base/ComboBox";
import Icon from "@base/Icon";
import type { GroupMinimal } from "@virtool/contracts";
import { X } from "lucide-react";
import type { ReactNode } from "react";

/** A fixed locale keeps the server-rendered order identical in the browser. */
const collator = new Intl.Collator("en");

type GroupMembershipFieldProps = {
	/** Every group that exists */
	groups: GroupMinimal[];

	/** The groups the user is a member of */
	memberGroups: GroupMinimal[];

	/** The id of the user's primary group, or null if none */
	primaryGroupId: number | null;

	/** Called when a group is added to the membership */
	onAdd: (id: number) => void;

	/** Called when a group is removed from the membership */
	onRemove: (id: number) => void;

	/** Called when the primary group changes */
	onPrimaryGroupChange: (id: number | null) => void;

	/** Content shown instead of the combobox, such as a loading or error state */
	addPlaceholder?: ReactNode;
};

/**
 * A controlled field for a user's group membership and primary group.
 *
 * A searchable combobox adds groups. Each member is a row with a toggle that
 * makes it the primary group and a button to remove the membership. Pressing
 * the toggle of the primary group leaves the user without one. The member list
 * scrolls when it is longer than a few rows.
 */
export default function GroupMembershipField({
	groups,
	memberGroups,
	primaryGroupId,
	onAdd,
	onRemove,
	onPrimaryGroupChange,
	addPlaceholder,
}: GroupMembershipFieldProps) {
	const [results, term, setTerm] = useFuse<GroupMinimal>(groups, ["name"]);

	const memberIds = new Set(memberGroups.map((group) => group.id));
	const availableGroups = results.filter((group) => !memberIds.has(group.id));
	const sortedMembers = memberGroups.toSorted((a, b) =>
		collator.compare(a.name, b.name),
	);

	function renderAdd() {
		if (addPlaceholder) {
			return addPlaceholder;
		}

		if (memberIds.size >= groups.length) {
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
					onAdd(group.id);
					setTerm("");
				}}
				term={term}
				onTermChange={setTerm}
				itemToKey={(group) => String(group.id)}
				itemToString={(group) => group.name}
				placeholder="Add group"
			/>
		);
	}

	function renderMembership() {
		if (sortedMembers.length === 0) {
			return (
				<p className="mt-4 text-gray-500">
					This user is not a member of any groups.
				</p>
			);
		}

		return (
			<BoxGroup className="mt-4 mb-0 max-h-64 overflow-y-auto">
				{sortedMembers.map((group) => (
					<BoxGroupSection key={group.id} className="flex items-center gap-3">
						<span className="grow">{group.name}</span>
						<ButtonToggle
							aria-label={`Primary group: ${group.name}`}
							className="min-h-8 bg-transparent px-2 text-sm text-gray-500 hover:bg-gray-100 hover:text-gray-800"
							pressed={group.id === primaryGroupId}
							onPressedChange={(pressed) =>
								onPrimaryGroupChange(pressed ? group.id : null)
							}
						>
							Primary
						</ButtonToggle>
						<button
							type="button"
							aria-label={`Remove ${group.name}`}
							className="text-gray-500 hover:text-gray-800"
							onClick={() => onRemove(group.id)}
						>
							<Icon icon={X} />
						</button>
					</BoxGroupSection>
				))}
			</BoxGroup>
		);
	}

	return (
		<div>
			{renderAdd()}
			{renderMembership()}
		</div>
	);
}
