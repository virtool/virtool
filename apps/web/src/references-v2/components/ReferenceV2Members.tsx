import { cn } from "@app/cn";
import { BoxGroup, BoxGroupSection } from "@base/Box";
import Checkbox from "@base/Checkbox";
import CompactScrollList from "@base/CompactScrollList";
import { Dialog, DialogContent, DialogTitle } from "@base/Dialog";
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from "@base/Empty";
import { IconButton, InitialIcon } from "@base/Icon";
import QueryError from "@base/QueryError";
import SearchToolbar from "@base/SearchToolbar";
import SectionHeader from "@base/SectionHeader";
import { useInfiniteFindGroups } from "@groups/queries";
import { useCheckReferenceV2Right } from "@references-v2/hooks";
import {
	type ReferenceV2MemberNoun,
	useAddReferenceV2Member,
	useRemoveReferenceV2Member,
	useUpdateReferenceV2Member,
} from "@references-v2/queries";
import { useInfiniteFindUsers } from "@users/queries";
import type {
	GroupMinimal,
	ReferenceV2Group,
	ReferenceV2Right,
	ReferenceV2User,
	User,
} from "@virtool/contracts";
import { Pencil, Trash, Users } from "lucide-react";
import { useState } from "react";

const rights: ReferenceV2Right[] = ["modifyOtu", "publishVersion", "modify"];
const descriptions: Record<ReferenceV2Right, string> = {
	publishVersion: "Can publish immutable versions for use in analyses.",
	modify: "Can modify reference properties and settings.",
	modifyOtu: "Can modify OTU records in the reference.",
};
const labels: Record<ReferenceV2Right, string> = {
	publishVersion: "Publish versions",
	modify: "Modify reference",
	modifyOtu: "Modify OTUs",
};

type Member = ReferenceV2User | ReferenceV2Group;

function getMemberName(member: Member): string {
	return "handle" in member ? member.handle : member.name;
}

function EditMember({
	member,
	noun,
	referenceId,
	onClose,
}: {
	member?: Member;
	noun: ReferenceV2MemberNoun;
	referenceId: string;
	onClose: () => void;
}) {
	const mutation = useUpdateReferenceV2Member(referenceId, noun);
	function handleChange(right: ReferenceV2Right, enabled: boolean) {
		if (member) {
			mutation.mutate({ id: member.id, update: { [right]: enabled } });
		}
	}
	return (
		<Dialog open={Boolean(member)} onOpenChange={onClose}>
			<DialogContent>
				<DialogTitle>
					Modify rights for {member ? getMemberName(member) : "member"}
				</DialogTitle>
				{rights.map((right) => (
					<div className="flex items-start not-last:mb-4" key={right}>
						<div className="mt-px">
							<Checkbox
								checked={member?.[right] ?? false}
								id={`ReferenceV2RightCheckbox-${right}`}
								onClick={() => handleChange(right, !(member?.[right] ?? false))}
							/>
						</div>
						<div className="flex flex-col pl-2.5">
							<strong>{labels[right]}</strong>
							<small className="pt-0.5">{descriptions[right]}</small>
						</div>
					</div>
				))}
			</DialogContent>
		</Dialog>
	);
}

function AddMember({
	members,
	noun,
	referenceId,
	show,
	onClose,
}: {
	members: Member[];
	noun: ReferenceV2MemberNoun;
	referenceId: string;
	show: boolean;
	onClose: () => void;
}) {
	const [term, setTerm] = useState("");
	const usersQuery = useInfiniteFindUsers(25, noun === "user" ? term : "");
	const groupsQuery = useInfiniteFindGroups(25, noun === "group" ? term : "");
	const query = noun === "user" ? usersQuery : groupsQuery;
	const mutation = useAddReferenceV2Member(referenceId, noun);

	function handleClose() {
		setTerm("");
		onClose();
	}
	if (query.isError && !query.data) {
		return (
			<Dialog open={show} onOpenChange={handleClose}>
				<DialogContent>
					<DialogTitle>Add {noun}</DialogTitle>
					<QueryError noun={`${noun}s`} />
				</DialogContent>
			</Dialog>
		);
	}
	if (query.isPending) {
		return null;
	}

	const memberIds = members.map((member) => member.id);
	const items: Array<User | GroupMinimal> = (
		noun === "user"
			? (usersQuery.data?.pages.flatMap((page) => page.items) ?? [])
			: (groupsQuery.data?.pages.flatMap((page) => page.items) ?? [])
	).filter((item) => !memberIds.includes(item.id));
	function renderRow(item: unknown) {
		const value = item as User | GroupMinimal;
		const name = "handle" in value ? value.handle : value.name;
		return (
			<button
				key={value.id}
				type="button"
				className={cn(
					"flex w-full cursor-pointer items-center gap-1 px-6 py-3 text-left",
					"border-b border-gray-300 last:border-b-0 hover:bg-gray-50",
				)}
				onClick={() => mutation.mutate(value.id)}
			>
				<InitialIcon size="md" handle={name} />
				{name}
			</button>
		);
	}
	return (
		<Dialog open={show} onOpenChange={handleClose}>
			<DialogContent>
				<DialogTitle>Add {noun}</DialogTitle>
				<SearchToolbar
					aria-label={`Search ${noun}s`}
					onChange={setTerm}
					placeholder={noun === "user" ? "Username" : "Group name"}
					value={term}
				/>
				{items.length ? (
					<CompactScrollList
						className="border border-gray-300 rounded overflow-y-auto h-80"
						fetchNextPage={query.fetchNextPage}
						isFetchingNextPage={query.isFetchingNextPage}
						isPending={query.isPending}
						items={items}
						renderRow={renderRow}
					/>
				) : (
					<BoxGroup>
						<BoxGroupSection>
							<Empty className="py-12">
								<EmptyTitle>No other {noun}s found</EmptyTitle>
							</Empty>
						</BoxGroupSection>
					</BoxGroup>
				)}
			</DialogContent>
		</Dialog>
	);
}

/** Manage users or groups granted access to a v2 Reference. */
export default function ReferenceV2Members({
	members,
	noun,
	referenceId,
}: {
	members: Member[];
	noun: ReferenceV2MemberNoun;
	referenceId: string;
}) {
	const canModify = useCheckReferenceV2Right(referenceId, "modify");
	const removeMutation = useRemoveReferenceV2Member(referenceId, noun);
	const [editId, setEditId] = useState<number>();
	const [isAdding, setIsAdding] = useState(false);
	const plural = `${noun}s`;
	return (
		<section>
			<SectionHeader className="[&_h2]:capitalize">
				<h2 className="flex items-center">
					{plural}
					{canModify && (
						<button
							className="bg-transparent border-0 cursor-pointer ml-auto p-0 text-sm font-medium"
							onClick={() => setIsAdding(true)}
							type="button"
						>
							Add {noun}
						</button>
					)}
				</h2>
				<p>
					Manage membership and rights for {plural} who have access to this
					reference.
				</p>
			</SectionHeader>
			<BoxGroup>
				{members.length ? (
					members.map((member) => (
						<BoxGroupSection className="flex items-center" key={member.id}>
							<InitialIcon handle={getMemberName(member)} size="lg" />
							<span className="ml-2">{getMemberName(member)}</span>
							{canModify && (
								<span className="flex items-center gap-1 ml-auto">
									<IconButton
										IconComponent={Pencil}
										color="gray"
										tip="Edit member"
										onClick={() => setEditId(member.id)}
									/>
									<IconButton
										IconComponent={Trash}
										color="red"
										tip="Remove member"
										onClick={() => removeMutation.mutate(member.id)}
									/>
								</span>
							)}
						</BoxGroupSection>
					))
				) : (
					<BoxGroupSection>
						<Empty className="h-72">
							<EmptyMedia className="text-gray-400">
								<Users size={40} strokeWidth={1.5} />
							</EmptyMedia>
							<EmptyTitle>No {plural} found</EmptyTitle>
							<EmptyDescription>
								This reference has no {plural} yet.
							</EmptyDescription>
						</Empty>
					</BoxGroupSection>
				)}
			</BoxGroup>
			<AddMember
				members={members}
				noun={noun}
				referenceId={referenceId}
				show={isAdding}
				onClose={() => setIsAdding(false)}
			/>
			<EditMember
				member={members.find((member) => member.id === editId)}
				noun={noun}
				referenceId={referenceId}
				onClose={() => setEditId(undefined)}
			/>
		</section>
	);
}
