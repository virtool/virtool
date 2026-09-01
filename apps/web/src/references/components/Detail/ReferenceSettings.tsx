import { useSuspenseReference } from "@references/queries";
/**
 * The reference settings view allowing users to manage the reference
 */
import { getRouteApi } from "@tanstack/react-router";
import { sortBy } from "es-toolkit";
import { useState } from "react";
import { ArchivedSourceTypes } from "../SourceTypes/ArchivedSourceTypes";
import { LocalSourceTypes } from "../SourceTypes/LocalSourceTypes";
import ReferenceMembers from "./ReferenceMembers";

const routeApi = getRouteApi("/_authenticated/refs/$refId");

export default function ReferenceSettings() {
	const { refId } = routeApi.useParams();
	const referenceId = Number(refId);
	const { data } = useSuspenseReference(referenceId);

	const [editUserId, setEditUserId] = useState<number>();
	const [editGroupId, setEditGroupId] = useState<number>();
	const [openAddUser, setOpenAddUser] = useState(false);
	const [openAddGroup, setOpenAddGroup] = useState(false);

	return (
		<>
			{data.archived ? <ArchivedSourceTypes /> : <LocalSourceTypes />}
			<ReferenceMembers
				editId={editUserId}
				noun="user"
				members={sortBy(data.users, ["id"])}
				openAdd={openAddUser}
				refId={referenceId}
				setEditId={setEditUserId}
				setOpenAdd={setOpenAddUser}
			/>
			<ReferenceMembers
				editId={editGroupId}
				noun="group"
				members={sortBy(data.groups, ["id"])}
				openAdd={openAddGroup}
				refId={referenceId}
				setEditId={setEditGroupId}
				setOpenAdd={setOpenAddGroup}
			/>
		</>
	);
}
