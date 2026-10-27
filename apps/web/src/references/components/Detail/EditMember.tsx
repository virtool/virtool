import { Dialog, DialogContent, DialogTitle } from "@base/Dialog";
import {
	type ReferenceMemberNoun,
	useUpdateReferenceMember,
} from "@references/queries";
import type {
	ReferenceGroup,
	ReferenceRights,
	ReferenceUser,
} from "@virtool/contracts";
import { ReferenceRight } from "./ReferenceRight";

const rights: (keyof ReferenceRights)[] = ["modifyOtu", "build", "modify"];

type EditReferenceMemberProps = {
	editId?: number;
	member?: ReferenceGroup | ReferenceUser;
	noun: ReferenceMemberNoun;
	refId: number;
	unsetEditId?: () => void;
};

/**
 * Displays a dialog to modify rights for a member
 */
export default function EditReferenceMember({
	editId,
	noun,
	refId,
	member,
	unsetEditId = () => {},
}: EditReferenceMemberProps) {
	const mutation = useUpdateReferenceMember(noun);

	function handleChange(key: keyof ReferenceRights, enabled: boolean) {
		if (!editId) {
			return;
		}

		mutation.mutate({
			refId,
			id: editId,
			update: { [key]: enabled } as Partial<ReferenceRights>,
		});
	}

	const rightComponents = rights.map((right) => (
		<ReferenceRight
			key={right}
			right={right}
			enabled={member?.[right] ?? false}
			onToggle={handleChange}
		/>
	));

	return (
		<Dialog open={Boolean(editId)} onOpenChange={() => unsetEditId()}>
			<DialogContent>
				<DialogTitle>
					Modify Rights for{" "}
					{(member as ReferenceUser)?.handle ||
						(member as ReferenceGroup)?.name}
				</DialogTitle>
				{rightComponents}
			</DialogContent>
		</Dialog>
	);
}
