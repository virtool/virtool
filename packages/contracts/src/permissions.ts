/** The names of every legacy group permission, in a stable order. */
export const PERMISSION_NAMES = [
	"create_ref",
	"create_sample",
	"modify_hmm",
	"modify_subtraction",
	"remove_file",
	"upload_file",
] as const;

/** A legacy group permission that gates a specific action. */
export type Permission = (typeof PERMISSION_NAMES)[number];

/** A full set of permission flags, one boolean per permission. */
export type Permissions = Record<Permission, boolean>;

/** Build a permission set with every flag set to `false`. */
export function emptyPermissions(): Permissions {
	return Object.fromEntries(
		PERMISSION_NAMES.map((name) => [name, false]),
	) as Permissions;
}
