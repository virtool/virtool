import { cn } from "@app/cn";
import BoxGroup from "@base/BoxGroup";
import BoxGroupSection from "@base/BoxGroupSection";
import CompactScrollList from "@base/CompactScrollList";
import { Dialog, DialogContent, DialogTitle } from "@base/Dialog";
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from "@base/Empty";
import InitialIcon from "@base/InitialIcon";
import QueryError from "@base/QueryError";
import SearchToolbar from "@base/SearchToolbar";
import { useInfiniteFindGroups } from "@groups/queries";
import type { GroupMinimal } from "@groups/types";
import { useAddReferenceMember } from "@references/queries";
import type { ReferenceGroup } from "@virtool/contracts";
import { Users } from "lucide-react";
import { useState } from "react";

type AddReferenceGroupProps = {
	groups: ReferenceGroup[];
	/** A callback to hide the dialog */
	onHide: () => void;
	refId: number;
	/** Indicates whether the dialog for adding a reference group is visible */
	show: boolean;
};

/**
 * Displays a dialog for adding a reference member
 */
export default function AddReferenceGroup({
	groups,
	onHide,
	refId,
	show,
}: AddReferenceGroupProps) {
	const mutation = useAddReferenceMember(refId, "group");
	const [term, setTerm] = useState("");
	const { data, isPending, isError, isFetchingNextPage, fetchNextPage } =
		useInfiniteFindGroups(25, term);

	function onOpenChange() {
		onHide();
		setTerm("");
	}

	if (isError && !data) {
		return (
			<Dialog open={show} onOpenChange={onOpenChange}>
				<DialogContent>
					<DialogTitle>Add Group</DialogTitle>
					<QueryError noun="groups" />
				</DialogContent>
			</Dialog>
		);
	}

	if (isPending) {
		return null;
	}

	const groupIds = groups.map((g) => g.id);
	const items = data.pages.flatMap((page) => page.items);
	const filteredItems = items.filter((item) => !groupIds.includes(item.id));

	// CompactScrollList types its rows as `unknown`; the items are groups.
	function renderRow(item: unknown) {
		const group = item as GroupMinimal;
		return (
			<button
				key={group.id}
				type="button"
				className={cn(
					"flex w-full cursor-pointer items-center gap-1 px-6 py-3 text-left",
					"border-b border-gray-300 last:border-b-0",
					"hover:bg-gray-50",
					"focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-600/50",
					"[&_.InitialIcon]:mr-1",
				)}
				onClick={() => mutation.mutate({ id: group.id })}
			>
				<InitialIcon size="md" handle={group.name} />
				{group.name}
			</button>
		);
	}

	return (
		<Dialog open={show} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogTitle>Add Group</DialogTitle>
				<SearchToolbar
					aria-label="Search groups"
					onChange={setTerm}
					placeholder="Group name"
					value={term}
				/>
				{filteredItems.length ? (
					<CompactScrollList
						className="border border-gray-300 rounded overflow-y-auto h-80"
						fetchNextPage={fetchNextPage}
						isFetchingNextPage={isFetchingNextPage}
						isPending={isPending}
						items={filteredItems}
						renderRow={renderRow}
					/>
				) : (
					<BoxGroup>
						<BoxGroupSection>
							<Empty className="py-12">
								<EmptyMedia className="text-gray-400">
									<Users size={40} strokeWidth={1.5} />
								</EmptyMedia>
								<EmptyTitle>No other groups found</EmptyTitle>
								<EmptyDescription>
									There are no other groups to add.
								</EmptyDescription>
							</Empty>
						</BoxGroupSection>
					</BoxGroup>
				)}
			</DialogContent>
		</Dialog>
	);
}
