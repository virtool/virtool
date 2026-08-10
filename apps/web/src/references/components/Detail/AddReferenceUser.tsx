import { cn } from "@app/cn";
import BoxGroup from "@base/BoxGroup";
import BoxGroupSection from "@base/BoxGroupSection";
import CompactScrollList from "@base/CompactScrollList";
import { Dialog, DialogContent, DialogTitle } from "@base/Dialog";
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from "@base/Empty";
import InitialIcon from "@base/InitialIcon";
import QueryError from "@base/QueryError";
import SearchToolbar from "@base/SearchToolbar";
import { useAddReferenceMember } from "@references/queries";
import { useInfiniteFindUsers } from "@users/queries";
import type { ReferenceUser, User } from "@virtool/contracts";
import { Users } from "lucide-react";
import { useState } from "react";

type AddReferenceUserProps = {
	users: ReferenceUser[];
	/** A callback to hide the dialog */
	onHide: () => void;
	refId: number;
	/** Indicates whether the dialog for adding a reference group is visible */
	show: boolean;
};

/**
 * Displays a dialog for adding a reference member
 */
export default function AddReferenceUser({
	users,
	onHide,
	refId,
	show,
}: AddReferenceUserProps) {
	const mutation = useAddReferenceMember(refId, "user");
	const [term, setTerm] = useState("");
	const { data, isPending, isError, isFetchingNextPage, fetchNextPage } =
		useInfiniteFindUsers(25, term);

	function onOpenChange() {
		onHide();
		setTerm("");
	}

	if (isError && !data) {
		return (
			<Dialog open={show} onOpenChange={onOpenChange}>
				<DialogContent>
					<DialogTitle>Add User</DialogTitle>
					<QueryError noun="users" />
				</DialogContent>
			</Dialog>
		);
	}

	if (isPending) {
		return null;
	}

	const userIds = users.map((u) => u.id);
	const items = data.pages.flatMap((page) => page.items);
	const filteredItems = items.filter((item) => !userIds.includes(item.id));

	// CompactScrollList types its rows as `unknown`; the items are users.
	function renderRow(item: unknown) {
		const user = item as User;
		return (
			<button
				key={user.id}
				type="button"
				className={cn(
					"flex w-full cursor-pointer items-center gap-1 px-6 py-3 text-left",
					"border-b border-gray-300 last:border-b-0",
					"hover:bg-gray-50",
					"focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-600/50",
					"[&_.InitialIcon]:mr-1",
				)}
				onClick={() => mutation.mutate({ id: user.id })}
			>
				<InitialIcon size="md" handle={user.handle} />
				{user.handle}
			</button>
		);
	}

	return (
		<Dialog open={show} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogTitle>Add User</DialogTitle>
				<SearchToolbar
					aria-label="Search users"
					onChange={setTerm}
					placeholder="Username"
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
								<EmptyTitle>No other users found</EmptyTitle>
								<EmptyDescription>
									There are no other users to add.
								</EmptyDescription>
							</Empty>
						</BoxGroupSection>
					</BoxGroup>
				)}
			</DialogContent>
		</Dialog>
	);
}
