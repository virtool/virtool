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
	handle: "admin",
	password: "hello world",
};

describe("createAdministrator", () => {
	it("creates a full administrator when no users exist", async () => {
		const result = await createAdministrator(db, input);

		expect(result.status).toBe("created");
		const rows = await db
			.select({
				administratorRole: users.administratorRole,
				email: users.email,
				handle: users.handle,
			})
			.from(users);
		expect(rows).toEqual([
			{
				administratorRole: "full",
				email: "admin@example.com",
				handle: "admin",
			},
		]);
	});

	it("leaves existing users unchanged", async () => {
		await seedUser(db, { handle: "alice" });

		const result = await createAdministrator(db, input);

		expect(result).toEqual({ status: "exists" });
		const rows = await db.select({ handle: users.handle }).from(users);
		expect(rows).toEqual([{ handle: "alice" }]);
	});

	it("rejects a reserved handle", async () => {
		await expect(
			createAdministrator(db, { ...input, handle: "virtool" }),
		).rejects.toThrow("Reserved user name: virtool");
	});

	it("rejects an invalid email", async () => {
		await expect(
			createAdministrator(db, { ...input, email: "admin" }),
		).rejects.toThrow("Enter a valid email address.");
	});

	it("rejects a password shorter than the configured minimum", async () => {
		await expect(
			createAdministrator(db, { ...input, password: "short" }),
		).rejects.toThrow("Password does not meet minimum length requirement (8)");
	});

	it("does not check the credentials when users exist", async () => {
		await seedUser(db, { handle: "alice" });

		const result = await createAdministrator(db, {
			email: "admin",
			handle: "virtool",
			password: "short",
		});

		expect(result).toEqual({ status: "exists" });
	});
});

describe("parseAdministratorArgs", () => {
	it("reads values that start with a hyphen", () => {
		expect(
			parseAdministratorArgs([
				"--handle=admin",
				"--email=admin@example.com",
				"--password=-secret123",
			]),
		).toEqual({
			email: "admin@example.com",
			handle: "admin",
			password: "-secret123",
		});
	});

	it("requires every option", () => {
		expect(() => parseAdministratorArgs(["--handle=admin"])).toThrow(
			"create administrator requires --handle, --email, and --password",
		);
	});
});
