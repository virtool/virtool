import { objectHasProperty } from "@app/common";
import BoxGroup from "@base/BoxGroup";
import BoxGroupHeader from "@base/BoxGroupHeader";
import BoxGroupSection from "@base/BoxGroupSection";
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from "@base/Empty";
import { useCheckReferenceRight } from "@references/hooks";
import {
	type ReferenceMemberNoun,
	useRemoveReferenceUser,
} from "@references/queries";
import type { ReferenceGroup, ReferenceUser } from "@virtool/contracts";
import { Users } from "lucide-react";
import AddReferenceGroup from "./AddReferenceGroup";
import AddReferenceUser from "./AddReferenceUser";
import EditReferenceMember from "./EditMember";
import MemberItem from "./MemberItem";

type ReferenceMembersProps = {
	editId?: number;
	/** The list of users or groups associated with the reference */
	members: ReferenceGroup[] | ReferenceUser[];

	/** Whether the member is a user or a group */
	noun: ReferenceMemberNoun;

	openAdd?: boolean;
	refId: number;
	setEditId?: (id?: number) => void;
	setOpenAdd?: (open: boolean) => void;
};

/**
 * Displays a component for managing who can access a reference by users or groups
 */
export default function ReferenceMembers({
	editId,
	members,
	noun,
	openAdd = false,
	refId,
	setEditId = () => {},
	setOpenAdd = () => {},
}: ReferenceMembersProps) {
	const mutation = useRemoveReferenceUser(refId, noun);
	const { hasPermission: canModify } = useCheckReferenceRight(refId, "modify");

	function handleHide() {
		setOpenAdd(false);
		setEditId(undefined);
	}

	const plural = `${noun}s`;

	return (
		<>
			<BoxGroup>
				<BoxGroupHeader className="pb-2.5 [&_h2]:capitalize">
					<h2>
						{plural}
						{canModify && (
							<button
								className="bg-transparent border-0 cursor-pointer ml-auto p-0"
								onClick={() => setOpenAdd(true)}
								type="button"
							>
								Add {noun}
							</button>
						)}
					</h2>
					<p>Manage membership and rights for reference {plural}.</p>
				</BoxGroupHeader>
				{members.length ? (
					members.map((member: ReferenceGroup | ReferenceUser) => {
						const handleOrName = objectHasProperty(member, "handle")
							? (member as ReferenceUser).handle
							: (member as ReferenceGroup).name;

						return (
							<MemberItem
								key={member.id}
								canModify={canModify}
								handleOrName={handleOrName}
								id={member.id}
								onEdit={(id) => setEditId(id)}
								onRemove={(id) => mutation.mutate({ id })}
							/>
						);
					})
				) : (
					<BoxGroupSection>
						<Empty className="h-72">
							<EmptyMedia className="text-gray-400">
								<Users size={40} strokeWidth={1.5} />
							</EmptyMedia>
							<EmptyTitle>No {plural} found</EmptyTitle>
							<EmptyDescription>
								{`This reference has no ${plural} yet.`}
							</EmptyDescription>
						</Empty>
					</BoxGroupSection>
				)}
			</BoxGroup>
			{noun === "user" ? (
				<AddReferenceUser
					users={members as ReferenceUser[]}
					onHide={handleHide}
					refId={refId}
					show={openAdd}
				/>
			) : (
				<AddReferenceGroup
					groups={members as ReferenceGroup[]}
					onHide={handleHide}
					refId={refId}
					show={openAdd}
				/>
			)}
			<EditReferenceMember
				member={members.find(
					(member: ReferenceGroup | ReferenceUser) => member.id === editId,
				)}
				editId={editId}
				unsetEditId={() => setEditId(undefined)}
				noun={noun}
				refId={refId}
			/>
		</>
	);
}
