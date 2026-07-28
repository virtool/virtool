import { useCheckAdminRole } from "@administration/hooks";
import type { AdministratorRoleName } from "@administration/types";
import BoxGroupSection from "@base/BoxGroupSection";
import InitialIcon from "@base/InitialIcon";
import Label from "@base/Label";
import Link from "@base/Link";
import type { GroupMinimal } from "@virtool/contracts";
import type { ReactElement } from "react";

type UserItemProps = {
	administrator_role: AdministratorRoleName | null;
	handle: string;
	id: number;
	/** The primary group assigned to the user */
	primary_group: GroupMinimal | null;
};

/**
 * A condensed user item for use in a list of users
 */
export function UserItem({
	administrator_role,
	handle,
	id,
	primary_group,
}: UserItemProps): ReactElement {
	const { hasPermission: canEdit } = useCheckAdminRole(
		administrator_role === null ? "users" : "full",
	);

	return (
		<BoxGroupSection as="li" className="grid grid-cols-4 items-center">
			<div className="col-span-2 flex items-center gap-3">
				<InitialIcon size="lg" handle={handle} />
				{canEdit ? (
					<Link
						to="/administration/users/$userId"
						params={{ userId: String(id) }}
						className="text-lg font-medium"
					>
						{handle}
					</Link>
				) : (
					<strong className="text-lg font-medium">{handle}</strong>
				)}
			</div>
			<div className="flex items-center text-sm capitalize">
				{administrator_role && (
					<Label color="purple">{administrator_role} Administrator</Label>
				)}
			</div>
			<div className="flex items-center text-sm capitalize">
				{primary_group && <Label>{primary_group.name}</Label>}
			</div>
		</BoxGroupSection>
	);
}
