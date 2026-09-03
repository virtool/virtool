import { is } from "drizzle-orm";
import { getTableConfig, PgTable } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import * as schema from "./index";

/*
 Production's foreign keys carry Postgres's default constraint name,
 `{table}_{column}_fkey`, because Alembic never named them itself. Drizzle's
 inline `.references()` auto-names a constraint `{table}_{col}_{ref}_{refcol}_fk`
 instead, which agrees with production on everything but the name.

 Nothing catches that at apply time: migration `0000` is stamped as
 already-applied rather than run, so the wrong name reaches no database — it
 reaches `meta/0000_snapshot.json`, which every later `generate` diffs against.
 The first migration to touch a foreign key would then emit SQL naming a
 constraint production does not have, and fail long after the cause.

 So every foreign key is declared with a table-level `foreignKey({ name })`.
 This pins that.
*/

/* The barrel's exports are each typed with their own literal table name, and
   that union is not assignable to the general `PgTable`. Widen to `unknown`
   and let `is()` do the narrowing. */
function tables(): PgTable[] {
	return (Object.values(schema) as unknown[]).filter(
		(value): value is PgTable => is(value, PgTable),
	);
}

describe("foreign key constraint names", () => {
	const found = tables().flatMap((table) => {
		const config = getTableConfig(table);
		return config.foreignKeys.map((fk) => {
			const reference = fk.reference();
			return {
				actual: fk.getName(),
				expected: `${config.name}_${reference.columns.map((c) => c.name).join("_")}_fkey`,
			};
		});
	});

	it("covers every foreign key in the mirror", () => {
		expect(found).toHaveLength(59);
	});

	it.each(found)("names $expected", ({ actual, expected }) => {
		expect(actual).toBe(expected);
	});
});

/*
 Better Auth's own schema states no delete behaviour for the two-factor and
 passkey relationships, and its session and account relationships state only
 what Better Auth itself would generate. Every one of them is declared here
 instead, so a deleted user cannot leave a TOTP secret, a set of recovery codes,
 a passkey or a live browser session behind.
*/
describe("Better Auth user relationships", () => {
	const authTables = [
		"auth_accounts",
		"auth_passkeys",
		"auth_sessions",
		"auth_two_factors",
	];

	const found = tables()
		.map((table) => getTableConfig(table))
		.filter((config) => authTables.includes(config.name))
		.flatMap((config) =>
			config.foreignKeys.map((fk) => {
				const reference = fk.reference();
				return {
					table: config.name,
					columns: reference.columns.map((column) => column.name),
					foreignTable: getTableConfig(reference.foreignTable).name,
					onDelete: fk.onDelete,
				};
			}),
		);

	it("gives every Better Auth table exactly one", () => {
		expect(found.map((fk) => fk.table).sort()).toEqual(authTables);
	});

	it.each(found)("cascades $table to users", (fk) => {
		expect(fk.columns).toEqual(["user_id"]);
		expect(fk.foreignTable).toBe("users");
		expect(fk.onDelete).toBe("cascade");
	});
});
