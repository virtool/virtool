import { cn } from "@app/cn";
import { useFuse } from "@app/fuse";
import Badge from "@base/Badge";
import { BoxGroup, BoxGroupSection } from "@base/Box";
import ComboBox from "@base/ComboBox";
import Field, { FieldLabel } from "@base/Field";
import Icon from "@base/Icon";
import { RadioGroup, RadioGroupItem } from "@base/RadioGroup";
import type { GroupMinimal } from "@virtool/contracts";
import { X } from "lucide-react";
import type { ReactNode } from "react";

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
 * A searchable combobox adds groups. Each member is a row in a radio group
 * that selects the primary group, with a button to remove the membership. The
 * member list scrolls when it is longer than a few rows.
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
		a.name.localeCompare(b.name),
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
				renderOption={(group) => (
					<span className="capitalize">{group.name}</span>
				)}
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
			<RadioGroup
				className="mt-4"
				aria-label="Primary group"
				value={primaryGroupId === null ? "none" : String(primaryGroupId)}
				onValueChange={(value) =>
					onPrimaryGroupChange(value === "none" ? null : Number(value))
				}
			>
				<BoxGroup className="mb-0 max-h-64 overflow-y-auto">
					{sortedMembers.map((group) => {
						const isPrimary = group.id === primaryGroupId;

						return (
							<BoxGroupSection
								key={group.id}
								className={cn(
									"flex items-center gap-3",
									isPrimary && "bg-blue-50",
								)}
							>
								<Field orientation="horizontal" className="grow">
									<RadioGroupItem value={String(group.id)} />
									<FieldLabel className="grow capitalize cursor-pointer select-none">
										{group.name}
									</FieldLabel>
								</Field>
								{isPrimary && (
									<Badge color="blue" variant="soft">
										Primary
									</Badge>
								)}
								<button
									type="button"
									aria-label={`Remove ${group.name}`}
									className="text-gray-500 hover:text-gray-800"
									onClick={() => onRemove(group.id)}
								>
									<Icon icon={X} />
								</button>
							</BoxGroupSection>
						);
					})}
					<BoxGroupSection className="flex items-center gap-3">
						<Field orientation="horizontal" className="grow">
							<RadioGroupItem value="none" />
							<FieldLabel className="grow cursor-pointer select-none">
								No primary group
							</FieldLabel>
						</Field>
					</BoxGroupSection>
				</BoxGroup>
			</RadioGroup>
		);
	}

	return (
		<div>
			{renderAdd()}
			{renderMembership()}
		</div>
	);
}
