import { BoxGroup } from "@base/Box";
import Checkbox from "@base/Checkbox";
import SectionHeader from "@base/SectionHeader";
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
		<section>
			<SectionHeader>
				<h2>Permissions</h2>
			</SectionHeader>
			<BoxGroup>
				<div className="columns-2 p-3">{permissionComponents}</div>
			</BoxGroup>
		</section>
	);
}
