import { type DataMigrationArgs, defineAudit } from "../define";

// Frozen at 0029: these rules and SQL must not follow the live auth implementation.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const HANDLE_PATTERN = /^[a-zA-Z0-9_.]{3,30}$/;
const BCRYPT_PATTERN = /^\$2[aby]\$(0[4-9]|[12]\d|3[01])\$[./A-Za-z0-9]{53}$/;

type User = {
	id: number;
	handle: string;
	active: boolean;
	email: string;
	password: Buffer | null;
	auth_migrated_at: Date | null;
};

type Credential = {
	account_id: string;
	user_id: number;
	password: string | null;
};

function normalizeEmail(email: string): string {
	return email.trim().toLowerCase();
}

async function migrate({ client, signal, report }: DataMigrationArgs) {
	signal.throwIfAborted();
	try {
		return await client.begin(async function migrateTransaction(sql) {
			// Keep the duplicate scan and both directions of credential ownership
			// stable until commit, including rows that do not yet exist.
			await sql`SET LOCAL lock_timeout = '5s'`;
			await sql`LOCK TABLE public.users, public.auth_accounts IN SHARE ROW EXCLUSIVE MODE`;
			const users = await sql<User[]>`
				SELECT id, handle, active, email, password, auth_migrated_at
				FROM public.users ORDER BY id
			`;
			const accounts = await sql<Credential[]>`
				SELECT account_id, user_id, password FROM public.auth_accounts
				WHERE provider_id = 'credential' ORDER BY user_id, id
			`;
			const duplicateEmails = new Set<string>();
			const seenEmails = new Set<string>();
			for (const user of users) {
				const email = normalizeEmail(user.email);
				if (EMAIL_PATTERN.test(email)) {
					if (seenEmails.has(email)) {
						duplicateEmails.add(email);
					}
					seenEmails.add(email);
				}
			}

			const counts = {
				eligible: { active: 0, deactivated: 0 },
				migrated: { active: 0, deactivated: 0 },
				stale: { active: 0, deactivated: 0 },
				conflict: { active: 0, deactivated: 0 },
				blankEmail: { active: 0, deactivated: 0 },
				invalidEmail: { active: 0, deactivated: 0 },
				duplicateEmail: { active: 0, deactivated: 0 },
				invalidHandle: { active: 0, deactivated: 0 },
				invalidPassword: { active: 0, deactivated: 0 },
			};
			const credentials = {
				planned: 0,
				inserted: 0,
				alreadyPresent: 0,
				updated: 0,
				conflicting: 0,
				skipped: 0,
			};
			for (const user of users) {
				signal.throwIfAborted();
				const activity = user.active ? "active" : "deactivated";
				const email = normalizeEmail(user.email);
				const password = user.password?.toString("utf8");
				const linked = accounts.filter(
					(account) =>
						account.user_id === user.id ||
						account.account_id === String(user.id),
				);
				const account = linked[0];
				const conflict =
					linked.length > 1 ||
					(account !== undefined
						? account.user_id !== user.id ||
							account.account_id !== String(user.id) ||
							account.password === null ||
							user.auth_migrated_at === null
						: user.auth_migrated_at !== null);
				const invalidHandle = !HANDLE_PATTERN.test(user.handle);
				const invalidPassword =
					password === undefined || !BCRYPT_PATTERN.test(password);
				const incomplete =
					email === ""
						? "blankEmail"
						: !EMAIL_PATTERN.test(email)
							? "invalidEmail"
							: duplicateEmails.has(email)
								? "duplicateEmail"
								: undefined;
				if (incomplete !== undefined) {
					counts[incomplete][activity] += 1;
				}
				for (const [unsafe, classification, code] of [
					[conflict, "conflict", "credential_conflict"],
					[invalidHandle, "invalidHandle", "invalid_handle"],
					[invalidPassword, "invalidPassword", "invalid_password"],
				] as const) {
					if (unsafe) {
						counts[classification][activity] += 1;
						report({ code, subject: `user:${user.id}` });
					}
				}
				if (conflict) {
					credentials.conflicting += 1;
				}
				if (
					conflict ||
					invalidHandle ||
					invalidPassword ||
					incomplete !== undefined ||
					password === undefined
				) {
					credentials.skipped += 1;
					continue;
				}
				if (account !== undefined) {
					if (account.password === password) {
						counts.migrated[activity] += 1;
						credentials.alreadyPresent += 1;
					} else {
						await sql`UPDATE public.auth_accounts SET password = ${password}, updated_at = now()
								WHERE provider_id = 'credential' AND account_id = ${String(user.id)} AND user_id = ${user.id}`;
						counts.stale[activity] += 1;
						credentials.updated += 1;
					}
				} else {
					await sql`INSERT INTO public.auth_accounts
							(account_id, provider_id, user_id, password, created_at, updated_at)
							VALUES (${String(user.id)}, 'credential', ${user.id}, ${password}, now(), now())`;
					await sql`UPDATE public.users SET email = ${email}, username = ${user.handle.toLowerCase()},
							display_username = ${user.handle}, auth_migrated_at = now(), updated_at = now()
							WHERE id = ${user.id}`;
					counts.eligible[activity] += 1;
					credentials.planned += 1;
					credentials.inserted += 1;
				}
			}
			signal.throwIfAborted();
			return { users: users.length, counts, credentials };
		});
	} catch {
		// Driver errors may include rejected rows or bound password parameters.
		throw new Error(
			"legacy identity migration transaction failed or was aborted",
		);
	}
}

/** Frozen identity migration paired with the 0029 authentication gate. */
export const legacyIdentities = defineAudit({
	key: "legacy_identities",
	version: 2,
	migrationTag: "0029_audit_legacy_identities",
	kind: "audit",
	description: "migrate eligible legacy users and report unsafe identities",
	run: migrate,
});
