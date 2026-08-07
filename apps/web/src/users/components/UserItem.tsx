import { useCheckAdminRole } from "@administration/hooks";
import BoxGroupSection from "@base/BoxGroupSection";
import InitialIcon from "@base/InitialIcon";
import Label from "@base/Label";
import Link from "@base/Link";
import type { AdministratorRoleName, GroupMinimal } from "@virtool/contracts";
import type { ReactElement } from "react";

type UserItemProps = {
	administratorRole: AdministratorRoleName | null;
	handle: string;
	id: number;
	/** The primary group assigned to the user */
	primaryGroup: GroupMinimal | null;
};

/**
 * A condensed user item for use in a list of users
 */
export function UserItem({
	administratorRole,
	handle,
	id,
	primaryGroup,
}: UserItemProps): ReactElement {
	const { hasPermission: canEdit } = useCheckAdminRole(
		administratorRole === null ? "users" : "full",
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
				{administratorRole && (
					<Label color="purple">{administratorRole} Administrator</Label>
				)}
			</div>
			<div className="flex items-center text-sm capitalize">
				{primaryGroup && <Label>{primaryGroup.name}</Label>}
			</div>
		</BoxGroupSection>
	);
}
