import { checkPasswordLength } from "@virtool/contracts";
import type { Db } from "@virtool/data/db/pg";
import { getSettings } from "@virtool/data/settings/data";

/**
 * Check a password being set against the instance's configured minimum length,
 * throwing `PasswordTooShortError` if it falls short.
 *
 * Every path that sets a password goes through this rather than through the zod
 * validators — `createFirstUserFn`, `resetPasswordFn`, `createUserFn` and
 * `updateUserFn`. A validator runs before its handler with no database handle,
 * so it cannot read the configured minimum.
 * carrying a dump of the issue list.
 *
 * Each handler catches `PasswordTooShortError` and maps it to a 400 carrying the
 * message.
 *
 * The minimum is the `minimum_password_length` instance setting.
 */
export async function checkConfiguredPasswordLength(
	db: Db,
	password: string,
): Promise<void> {
	const { minimumPasswordLength } = await getSettings(db);
	checkPasswordLength(password, minimumPasswordLength);
}
