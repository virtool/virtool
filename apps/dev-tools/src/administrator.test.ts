import { seedUser } from "@virtool/data/auth/test/fixtures";
import type { Db } from "@virtool/data/db/pg";
import { users } from "@virtool/data/db/schema/users";
import {
	createTestDatabase,
	type TestDatabase,
} from "@virtool/data/db/test/fixtures";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createAdministrator, parseAdministratorArgs } from "./administrator";

let database: TestDatabase;
let db: Db;

beforeAll(async () => {
	database = await createTestDatabase();
	db = database.db;
}, 60_000);

afterAll(async () => {
	await database.drop();
});

beforeEach(async () => {
	await db.delete(users);
});

const input = {
	email: "Admin@Example.com",
	password: "hello world",
	username: "Admin",
};

describe("createAdministrator", () => {
	it("creates a full administrator when no users exist", async () => {
		const result = await createAdministrator(db, input);

		expect(result.status).toBe("created");
		const rows = await db
			.select({
				administratorRole: users.administratorRole,
				email: users.email,
				username: users.username,
			})
			.from(users);
		expect(rows).toEqual([
			{
				administratorRole: "full",
				email: "admin@example.com",
				username: "admin",
			},
		]);
	});

	it("leaves existing users unchanged", async () => {
		await seedUser(db, { username: "alice" });

		const result = await createAdministrator(db, input);

		expect(result).toEqual({ status: "exists" });
		const rows = await db.select({ username: users.username }).from(users);
		expect(rows).toEqual([{ username: "alice" }]);
	});

	it("rejects a reserved username in any case", async () => {
		await expect(
			createAdministrator(db, { ...input, username: "Virtool" }),
		).rejects.toThrow("Reserved username: virtool");
	});

	it("rejects an invalid email", async () => {
		await expect(
			createAdministrator(db, { ...input, email: "admin" }),
		).rejects.toThrow("Enter a valid email address.");
	});

	it("rejects a password shorter than the configured minimum", async () => {
		await expect(
			createAdministrator(db, { ...input, password: "short" }),
		).rejects.toThrow("Password must have at least 8 characters.");
	});

	it("does not check the credentials when users exist", async () => {
		await seedUser(db, { username: "alice" });

		const result = await createAdministrator(db, {
			email: "admin",
			password: "short",
			username: "virtool",
		});

		expect(result).toEqual({ status: "exists" });
	});
});

describe("parseAdministratorArgs", () => {
	it("reads values that start with a hyphen", () => {
		expect(
			parseAdministratorArgs([
				"--username=admin",
				"--email=admin@example.com",
				"--password=-secret123",
			]),
		).toEqual({
			email: "admin@example.com",
			password: "-secret123",
			username: "admin",
		});
	});

	it("requires every option", () => {
		expect(() => parseAdministratorArgs(["--username=admin"])).toThrow(
			"create administrator requires --username, --email, and --password",
		);
	});
});
