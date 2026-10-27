import { useFetchAccount } from "@account/account";
import { BoxGroup, BoxGroupSection } from "@base/Box";
import Checkbox from "@base/Checkbox";
import LoadingPlaceholder from "@base/LoadingPlaceholder";
import QueryError from "@base/QueryError";
import type { Permission, Permissions } from "@virtool/contracts";
import {
	AdministratorPermissions,
	hasSufficientAdminRole,
} from "@virtool/contracts";
import { sortBy } from "es-toolkit";

type ApiPermissionsProps = {
	className?: string;
	keyPermissions: Permissions;
	/** Callback function to handle permission selection */
	onChange: (permissions: Permissions) => void;
};

/**
 * Manages permissions for creating/updating an API
 */
export default function ApiKeyPermissions({
	className,
	keyPermissions,
	onChange,
}: ApiPermissionsProps) {
	const { data: account, isPending, isError } = useFetchAccount();

	if (isError && !account) {
		return <QueryError noun="your account" />;
	}

	if (isPending) {
		return <LoadingPlaceholder />;
	}

	const permissions = (
		Object.entries(keyPermissions) as [Permission, boolean][]
	).map(([name, allowed]) => ({ name, allowed }));

	const rowComponents = sortBy(permissions, [(p) => p.name]).map(
		(permission) => {
			const disabled =
				!hasSufficientAdminRole(
					AdministratorPermissions[permission.name],
					account.administratorRole,
				) && !account.permissions[permission.name];

			return (
				<BoxGroupSection key={permission.name}>
					<Checkbox
						checked={permission.allowed}
						id={`ApiPermission-${permission.name}`}
						label={permission.name}
						onClick={
							disabled
								? undefined
								: () =>
										onChange({
											...keyPermissions,
											[permission.name]: !permission.allowed,
										})
						}
					/>
				</BoxGroupSection>
			);
		},
	);

	return <BoxGroup className={className}>{rowComponents}</BoxGroup>;
}
