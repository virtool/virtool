import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
	AccountSetupHandleInUseError,
	completeAccountSetup,
	inspectAccountSetup,
} from "../auth/lifecycle";
import { seedUser } from "../auth/test/fixtures";
import type { Db } from "../db/pg";
import { authAccounts } from "../db/schema/auth";
import { emailOutbox } from "../db/schema/emailOutbox";
import { settings } from "../db/schema/settings";
import { setupTokens } from "../db/schema/setup";
import { users } from "../db/schema/users";
import { createTestDatabase, type TestDatabase } from "../db/test/fixtures";
import { claimDueEmails } from "../email/outbox";
import { seedGroup } from "../groups/test/fixtures";
import { seedSettings } from "../settings/test/fixtures";
import { GroupMembershipError, UserNotFoundError } from "./data";
import {
	createPendingInvitation,
	deletePendingUser,
	InvitationNotEligibleError,
	regenerateInvitation,
} from "./invitations";

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
	await db.delete(emailOutbox);
	await db.delete(users);
	await db.delete(settings);
	await seedSettings(db);
});

async function createInvitation() {
	const issuerUserId = await seedUser(db, { handle: "admin" });
	const created = await createPendingInvitation(db, {
		email: " ADA@Example.com ",
		issuerUserId,
		deliveryIntent: "copy_only",
		deliveryAvailable: false,
		getSetupUrl: (token) => `https://virtool.test/account-setup#token=${token}`,
	});
	if (!created.setupToken) {
		throw new Error("expected copy-only invitation token");
	}
	return { ...created, setupToken: created.setupToken };
}

describe("account invitations", () => {
	it("creates the pending user, passwordless identity, and token atomically", async () => {
		const created = await createInvitation();
		expect(created.user.lifecycleState).toBe("pending");
		expect(created.user.handle).toBe("");
		expect(created.setupToken).toMatch(/^[0-9a-f]{64}$/);
		expect(created.invitation.delivery).toBe("copy_only");
		expect(created.invitation.email).toBe("ada@example.com");
		const [account] = await db.select().from(authAccounts);
		expect(account?.userId).toBe(created.user.id);
		expect(account?.password).toBeNull();
		expect(await inspectAccountSetup(db, created.setupToken)).toMatchObject({
			status: "valid",
			email: "ada@example.com",
		});
	});

	it("sets the role, groups, and default settings of the pending user", async () => {
		const issuerUserId = await seedUser(db, { handle: "admin" });
		const group = await seedGroup(db, { name: "researchers" });

		const created = await createPendingInvitation(db, {
			email: "ada@example.com",
			administratorRole: "users",
			groups: [group],
			issuerUserId,
			deliveryIntent: "copy_only",
			deliveryAvailable: false,
			getSetupUrl: (token) =>
				`https://virtool.test/account-setup#token=${token}`,
		});

		expect(created.user).toMatchObject({
			administratorRole: "users",
			active: true,
			forceReset: false,
		});
		expect(created.user.groups.map((entry) => entry.name)).toEqual([
			"researchers",
		]);
		const [row] = await db
			.select()
			.from(users)
			.where(eq(users.id, created.user.id));
		expect(row?.password).toBeNull();
		expect(row?.settings).toEqual({
			prefer_abbreviation: false,
			skip_quick_analyze_dialog: true,
			show_ids: true,
			show_versions: true,
			quick_analyze_workflow: "pathoscope",
		});
	});

	it("does not expose the bearer token for an emailed invitation", async () => {
		await db.update(settings).set({ emailEnabled: true });
		const issuerUserId = await seedUser(db, { handle: "admin" });
		const created = await createPendingInvitation(db, {
			email: "ada@example.com",
			issuerUserId,
			deliveryIntent: "email",
			deliveryAvailable: true,
			getSetupUrl: (token) =>
				`https://virtool.test/account-setup#token=${token}`,
		});
		expect(created.invitation.delivery).toBe("queued");
		expect(created.setupToken).toBeNull();
		expect(created.invitation.outboxStatus).toBe("queued");
	});

	it("deletes a pending user's queued invitation email", async () => {
		await db.update(settings).set({ emailEnabled: true });
		const issuerUserId = await seedUser(db, { handle: "admin" });
		const created = await createPendingInvitation(db, {
			email: "ada@example.com",
			issuerUserId,
			deliveryIntent: "email",
			deliveryAvailable: true,
			getSetupUrl: (token) =>
				`https://virtool.test/account-setup#token=${token}`,
		});
		await deletePendingUser(db, created.user.id);
		expect(await db.select().from(emailOutbox)).toEqual([]);
	});

	it("discards a superseded invitation email instead of sending it", async () => {
		await db.update(settings).set({ emailEnabled: true });
		const issuerUserId = await seedUser(db, { handle: "admin" });
		const options = {
			issuerUserId,
			deliveryIntent: "email" as const,
			deliveryAvailable: true,
			getSetupUrl: (token: string) =>
				`https://virtool.test/account-setup#token=${token}`,
		};
		const created = await createPendingInvitation(db, {
			...options,
			email: "ada@example.com",
		});
		await regenerateInvitation(db, created.user.id, options);

		const claimed = await claimDueEmails(db, {
			claimToken: "claim",
			leaseSeconds: 60,
			limit: 1,
		});
		expect(claimed.map(({ idempotencyKey }) => idempotencyKey)).toEqual([
			`account_setup/${created.user.id}/2`,
		]);
		expect(await db.select().from(emailOutbox)).toHaveLength(1);
	});

	it("allows multiple invitations before recipients choose handles", async () => {
		const first = await createInvitation();
		const second = await createPendingInvitation(db, {
			email: "other@example.com",
			issuerUserId: first.invitation.issuerUserId,
			deliveryIntent: "copy_only",
			deliveryAvailable: false,
			getSetupUrl: (token) =>
				`https://virtool.test/account-setup#token=${token}`,
		});
		expect(second.user.handle).toBe("");
	});

	it("keeps the invitation usable after a chosen handle conflicts", async () => {
		const created = await createInvitation();
		await seedUser(db, { handle: "Ada" });
		await expect(
			completeAccountSetup(db, {
				token: created.setupToken,
				handle: "ada",
				password: "a-real-password",
			}),
		).rejects.toBeInstanceOf(AccountSetupHandleInUseError);
		expect(await inspectAccountSetup(db, created.setupToken)).toMatchObject({
			status: "valid",
		});
	});

	it("rolls back the pending identity when group assignment fails", async () => {
		const issuerUserId = await seedUser(db, { handle: "admin" });
		await expect(
			createPendingInvitation(db, {
				email: "ada@example.com",
				issuerUserId,
				groups: [999_999],
				deliveryIntent: "copy_only",
				deliveryAvailable: false,
				getSetupUrl: (token) =>
					`https://virtool.test/account-setup#token=${token}`,
			}),
		).rejects.toBeInstanceOf(GroupMembershipError);
		expect(
			await db.select().from(users).where(eq(users.handle, "Ada")),
		).toHaveLength(0);
		expect(await db.select().from(setupTokens)).toHaveLength(0);
	});

	it("regenerates with one live generation", async () => {
		const created = await createInvitation();
		const regenerated = await regenerateInvitation(db, created.user.id, {
			issuerUserId: created.invitation.issuerUserId,
			deliveryIntent: "copy_only",
			deliveryAvailable: false,
			getSetupUrl: (token) =>
				`https://virtool.test/account-setup#token=${token}`,
		});
		expect(regenerated.invitation.generation).toBe(2);
		if (!regenerated.setupToken) {
			throw new Error("expected copy-only invitation token");
		}
		expect(await inspectAccountSetup(db, created.setupToken)).toEqual({
			status: "unusable",
		});
		expect(await inspectAccountSetup(db, regenerated.setupToken)).toMatchObject(
			{
				status: "valid",
			},
		);
	});

	it("deletes a pending user and invalidates their link", async () => {
		const created = await createInvitation();
		await deletePendingUser(db, created.user.id);
		expect(
			await db.select().from(users).where(eq(users.id, created.user.id)),
		).toEqual([]);
		expect(
			await db
				.select()
				.from(setupTokens)
				.where(eq(setupTokens.userId, created.user.id)),
		).toEqual([]);
		expect(await inspectAccountSetup(db, created.setupToken)).toEqual({
			status: "unusable",
		});
		await expect(deletePendingUser(db, created.user.id)).rejects.toThrow(
			UserNotFoundError,
		);
	});

	it("refuses to delete a user who accepted their invitation", async () => {
		const created = await createInvitation();
		await completeAccountSetup(db, {
			token: created.setupToken,
			handle: "Ada",
			password: "a-real-password",
			deliveryAvailable: false,
		});
		await expect(deletePendingUser(db, created.user.id)).rejects.toThrow(
			InvitationNotEligibleError,
		);
	});

	it("accepts once and leaves copied-link email unverified", async () => {
		const created = await createInvitation();
		const accepted = await completeAccountSetup(db, {
			token: created.setupToken,
			handle: "Ada",
			password: "a-real-password",
			deliveryAvailable: false,
		});
		expect(accepted.user.lifecycleState).toBe("normal");
		expect(accepted.user.handle).toBe("Ada");
		const [row] = await db
			.select()
			.from(users)
			.where(eq(users.id, created.user.id));
		expect(row?.email).toBe("ada@example.com");
		expect(row?.emailVerified).toBe(false);
		await expect(
			completeAccountSetup(db, {
				token: created.setupToken,
				password: "another-password",
			}),
		).rejects.toThrow();
	});

	it("queues a 24-hour verification after accepting a copied link", async () => {
		const created = await createInvitation();
		await db.update(settings).set({ emailEnabled: true });
		const accepted = await completeAccountSetup(db, {
			token: created.setupToken,
			handle: "Ada",
			password: "a-real-password",
			deliveryAvailable: true,
			getVerificationUrl: (token) =>
				`https://virtool.test/verify-email?token=${token}`,
		});
		expect(accepted.emailVerificationRequired).toBe(true);
		const [verification] = await db
			.select()
			.from(setupTokens)
			.where(eq(setupTokens.purpose, "email_verification"));
		const lifetimeMs = (verification?.expiresAt.getTime() ?? 0) - Date.now();
		expect(lifetimeMs).toBeGreaterThan(23 * 60 * 60 * 1000);
		expect(lifetimeMs).toBeLessThanOrEqual(24 * 60 * 60 * 1000);
		const [message] = await db.select().from(emailOutbox);
		expect(message?.template).toMatchObject({
			type: "email_verification",
			expiresInHours: 24,
		});
	});

	it("serializes acceptance against regeneration", async () => {
		const created = await createInvitation();
		const other = database.connect();
		try {
			const results = await Promise.allSettled([
				completeAccountSetup(db, {
					token: created.setupToken,
					password: "a-real-password",
				}),
				regenerateInvitation(other.db, created.user.id, {
					issuerUserId: created.invitation.issuerUserId,
					deliveryIntent: "copy_only",
					deliveryAvailable: false,
					getSetupUrl: (token) =>
						`https://virtool.test/account-setup#token=${token}`,
				}),
			]);
			expect(
				results.filter(({ status }) => status === "fulfilled"),
			).toHaveLength(1);
			const rows = await db.select().from(setupTokens);
			expect(
				rows.filter((row) => !row.consumedAt && !row.supersededAt).length,
			).toBeLessThanOrEqual(1);
		} finally {
			await other.close();
		}
	});
});
