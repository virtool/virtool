import {
	checkCanResetTotp,
	checkCanRevokeAccess,
	getGroupRemoval,
} from "@users/utils";
import type { Account } from "@virtool/contracts";
import { describe, expect, it } from "vitest";

const administrator = { administratorRole: "full" as const, id: 1 };

describe("checkCanResetTotp()", () => {
	it.each<[string, Account["administratorRole"], number, boolean, boolean]>([
		["an enrolled user", "full", 2, true, true],
		["a user without two-factor authentication", "full", 2, false, false],
		["an administrator without the full role", "users", 2, true, false],
		["the administrator's own account", "full", 1, true, false],
	])("should decide for %s", (_, role, userId, twoFactorEnabled, expected) => {
		expect(
			checkCanResetTotp(
				{ administratorRole: role, id: 1 },
				{ id: userId, twoFactorEnabled },
			),
		).toBe(expected);
	});

	it("should refuse while the account is unknown", () => {
		expect(
			checkCanResetTotp(undefined, { id: 2, twoFactorEnabled: true }),
		).toBe(false);
	});
});

describe("checkCanRevokeAccess()", () => {
	it.each([
		["another user", administrator, 2, true],
		["the administrator's own user", administrator, 1, false],
		["an unknown account", undefined, 2, false],
	])("should decide for %s", (_, account, userId, expected) => {
		expect(checkCanRevokeAccess(account, userId)).toBe(expected);
	});
});

describe("getGroupRemoval()", () => {
	it("should clear the primary group when it is removed", () => {
		expect(getGroupRemoval([1, 2], 1, 1)).toEqual({
			groups: [2],
			clearsPrimary: true,
		});
	});

	it("should keep the primary group when another is removed", () => {
		expect(getGroupRemoval([1, 2], 1, 2)).toEqual({
			groups: [1],
			clearsPrimary: false,
		});
	});
});
