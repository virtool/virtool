import type {
	AdministratorRoleName,
	GroupMinimal,
	Permissions,
	UserNested,
} from "@virtool/contracts";

/** A Virtool user */
export type User = UserNested & {
	/** Their administrator role defining what resources they can modify */
	administratorRole: AdministratorRoleName | null;

	/** Indicates if user is active */
	active: boolean;

	/** Whether the user will be forced to reset their password on next login */
	forceReset: boolean;

	/** A list of their groups */
	groups: Array<GroupMinimal>;

	/** The date of their last password change */
	lastPasswordChange: Date;

	/** Their permissions */
	permissions: Permissions;

	/** Their primary group */
	primaryGroup: GroupMinimal | null;
};
