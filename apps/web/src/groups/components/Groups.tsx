import Button from "@base/Button";
import DeleteAlert from "@base/DeleteAlert";
import { InputHeader } from "@base/Input";
import LoadingPlaceholder from "@base/LoadingPlaceholder";
import QueryError from "@base/QueryError";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@base/Tabs";
import type { GroupMinimal } from "@virtool/contracts";
import { sortBy } from "es-toolkit/compat";
import { useState } from "react";
import {
	useDeleteGroup,
	useFetchGroup,
	useListGroups,
	useUpdateGroup,
} from "../queries";
import Create from "./CreateGroup";
import { GroupMembers } from "./GroupMembers";
import { GroupPermissions } from "./GroupPermissions";

export default function Groups() {
	const updateGroupMutation = useUpdateGroup();
	const deleteMutation = useDeleteGroup();

	const [openCreateGroup, setOpenCreateGroup] = useState(false);
	const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
	const [prevGroups, setPrevGroups] = useState<
		GroupMinimal[] | undefined | null
	>(null);

	const {
		data: groups,
		isPending: isPendingGroups,
		isError: isErrorGroups,
	} = useListGroups();

	if (groups !== prevGroups) {
		setPrevGroups(groups);
		if (groups && !groups.find((g) => g.id === selectedGroupId)) {
			setSelectedGroupId(sortBy(groups, (g) => g.name)[0]?.id ?? null);
		}
	}

	const {
		data: selectedGroup,
		isPending: isPendingSelectedGroup,
		isError: isErrorSelectedGroup,
	} = useFetchGroup(selectedGroupId ?? 0);

	if (isErrorGroups && !groups) {
		return <QueryError noun="groups" />;
	}

	if (isPendingGroups || !groups) {
		return <LoadingPlaceholder className="mt-32" />;
	}

	if (isErrorSelectedGroup && groups.length && !selectedGroup) {
		return <QueryError noun="selected group" />;
	}

	if (groups.length && isPendingSelectedGroup) {
		return <LoadingPlaceholder className="mt-32" />;
	}

	const sortedGroups = sortBy(groups, (g) => g.name);
	const activeValue = selectedGroup ? String(selectedGroup.id) : "";

	return (
		<>
			<header className="flex items-center justify-between mb-5">
				<h2>Groups</h2>
				<Button color="blue" onClick={() => setOpenCreateGroup(true)}>
					Create
				</Button>
			</header>

			{groups.length && selectedGroup ? (
				<Tabs
					variant="vertical"
					value={activeValue}
					onValueChange={(value) => setSelectedGroupId(Number(value))}
				>
					<TabsList aria-label="Groups">
						{sortedGroups.map((group) => (
							<TabsTrigger key={group.id} value={String(group.id)}>
								{group.name}
							</TabsTrigger>
						))}
					</TabsList>

					<TabsContent value={activeValue}>
						<InputHeader
							id="name"
							value={selectedGroup.name}
							onSubmit={(name) =>
								updateGroupMutation.mutate({
									id: selectedGroup.id,
									name,
								})
							}
						/>
						<GroupPermissions selectedGroup={selectedGroup} />
						<GroupMembers members={selectedGroup.users} />
						<DeleteAlert
							outerClassName="!mb-0"
							message="Permanently delete this group."
							buttonText="Delete"
							onClick={() => deleteMutation.mutate({ id: selectedGroup.id })}
						/>
					</TabsContent>
				</Tabs>
			) : (
				<div className="bg-gray-200 flex items-center h-48 justify-center rounded-md text-gray-600">
					No Groups Exist
				</div>
			)}

			<Create open={openCreateGroup} setOpen={setOpenCreateGroup} />
		</>
	);
}
