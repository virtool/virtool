import { useFetchAccount } from "@account/account";
import { BoxGroup, BoxGroupSection } from "@base/Box";
import Checkbox from "@base/Checkbox";
import { FieldDescription } from "@base/Field";
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

	return (
		<div className={className}>
			<FieldDescription className="mt-0 mb-2">
				Permissions limit what the key can change. The key can read all the data
				that you can read.
			</FieldDescription>
			<BoxGroup>{rowComponents}</BoxGroup>
		</div>
	);
}
