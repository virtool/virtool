import { describe, expect, it } from "vitest";
import { getRecoveryCodesWarning } from "../recoveryCodes";

describe("getRecoveryCodesWarning()", () => {
	it.each([
		[3, "Only 3 recovery codes are left."],
		[2, "Only 2 recovery codes are left."],
		[1, "Only 1 recovery code is left."],
		[0, "You have no recovery codes left."],
	])("should warn when %i codes are left", (remaining, message) => {
		expect(
			getRecoveryCodesWarning({
				recoveryCodesRemaining: remaining,
				twoFactorEnabled: true,
			}),
		).toBe(
			`${message} Make new codes so that you can sign in if you lose your authenticator app.`,
		);
	});

	it.each([
		[
			"enough codes are left",
			{ recoveryCodesRemaining: 4, twoFactorEnabled: true },
		],
		[
			"the count is unknown",
			{ recoveryCodesRemaining: null, twoFactorEnabled: true },
		],
		["TOTP is off", { recoveryCodesRemaining: 0, twoFactorEnabled: false }],
	])("should not warn when %s", (_, security) => {
		expect(getRecoveryCodesWarning(security)).toBeNull();
	});
});
