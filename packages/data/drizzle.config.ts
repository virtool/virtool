import { defineConfig } from "drizzle-kit";

/*
 `generate` reads the schema and never connects, so an unset URL is not an
 error here. Only `migrate`, `push`, `pull` and `studio` connect, and they fail
 on the empty string with a connection error that names it.
*/
const url = process.env.VT_POSTGRES_URL ?? "";

export default defineConfig({
	dialect: "postgresql",
	/*
	 The barrel rather than a glob, so what a migration describes is exactly what
	 `createDb` types the runtime handle against. A glob would also pick up
	 `sql.ts`, which is deliberately absent from the barrel.
	*/
	schema: "./src/db/schema/index.ts",
	out: "./drizzle",
	/*
	 Every column in the mirror names itself explicitly, so this decides nothing
	 today. It is set so that a column added without an explicit name is emitted
	 as snake_case rather than under its camelCase TS identifier, which would
	 describe a column production does not have.
	*/
	casing: "snake_case",
	/*
	 Kit's own defaults, pinned. Production's bookkeeping row is inserted by hand
	 against this table and schema; if a later default moved either, kit would
	 find no stamp and run `0000` against a database that already has every
	 table in it.
	*/
	migrations: {
		table: "__drizzle_migrations",
		schema: "drizzle",
	},
	dbCredentials: { url },
});
