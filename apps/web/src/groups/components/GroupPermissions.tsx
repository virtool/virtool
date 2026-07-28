import BoxGroup from "@base/BoxGroup";
import BoxGroupHeader from "@base/BoxGroupHeader";
import Checkbox from "@base/Checkbox";
import type { Group } from "@virtool/contracts";
import { useUpdateGroup } from "../queries";

export function GroupPermissions({ selectedGroup }: { selectedGroup: Group }) {
	const updateGroupMutator = useUpdateGroup();

	const permissionComponents = Object.entries(selectedGroup.permissions).map(
		([permission, active]) => (
			<div key={permission} className="py-2 px-4">
				<Checkbox
					checked={active}
					id={`GroupPermissionCheckbox-${permission}`}
					label={permission}
					onClick={() =>
						updateGroupMutator.mutate({
							id: selectedGroup.id,
							permissions: { [permission]: !active },
						})
					}
				/>
			</div>
		),
	);

	return (
		<BoxGroup>
			<BoxGroupHeader>
				<h2>Permissions</h2>
			</BoxGroupHeader>
			<div className="columns-2 p-3">{permissionComponents}</div>
		</BoxGroup>
	);
}
