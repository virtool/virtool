import { describe, expect, it } from "vitest";
import { userQueryKeys } from "../keys";

function startsWith(key: readonly unknown[], prefix: readonly unknown[]) {
	return prefix.every((segment, index) => key[index] === segment);
}

describe("userQueryKeys", () => {
	it("gives the nested list its own key under lists(), so one invalidation covers it too", () => {
		expect(startsWith(userQueryKeys.nested(), userQueryKeys.lists())).toBe(
			true,
		);
		expect(userQueryKeys.nested()).not.toEqual(userQueryKeys.lists());
	});
});
