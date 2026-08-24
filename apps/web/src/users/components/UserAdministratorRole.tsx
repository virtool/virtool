import { useFetchAccount } from "@account/account";
import AdministratorRoleSelect from "@administration/components/AdministratorRoleSelect";
import { useCheckAdminRole } from "@administration/hooks";
import { useGetAdministratorRoles } from "@administration/queries";
import { IconButton } from "@base/Icon";
import { InputLabel } from "@base/Input";
import { useSetAdministratorRole } from "@users/queries";
import type { AdministratorRoleName } from "@virtool/contracts";
import { Trash } from "lucide-react";

type UserAdministratorRoleProps = {
	/** The id of the user being managed */
	id: number;

	/** The user's current administrator role, if any */
	role: AdministratorRoleName | null;
};

/**
 * Controls for assigning or removing a user's administrator role.
 *
 * Only rendered for full administrators managing a user other than themselves;
 * the server rejects a user changing their own role.
 */
export default function UserAdministratorRole({
	id,
	role,
}: UserAdministratorRoleProps) {
	const { data: account } = useFetchAccount();
	const { hasPermission: canManageRoles } = useCheckAdminRole("full");
	const { data: roles } = useGetAdministratorRoles();
	const mutation = useSetAdministratorRole();

	if (!canManageRoles || !account || account.id === id || !roles) {
		return null;
	}

	function onChange(value: AdministratorRoleName | null) {
		mutation.mutate({ user_id: id, role: value });
	}

	return (
		<div className="mb-4">
			<InputLabel htmlFor={`role-${id}`}>Administrator Role</InputLabel>
			<div className="flex items-center gap-2">
				<AdministratorRoleSelect
					className="grow"
					id={`role-${id}`}
					onChange={onChange}
					roles={roles}
					value={role ?? undefined}
				/>
				{role && (
					<IconButton
						IconComponent={Trash}
						color="red"
						tip="Remove administrator role"
						onClick={() => onChange(null)}
					/>
				)}
			</div>
		</div>
	);
}
