import { expect, it } from "vitest";
import { getRetryDelay } from "./retry.ts";

it("bounds exponential retry delay", () => {
	expect([0, 1, 4, 10].map(getRetryDelay)).toEqual([
		1_000, 2_000, 16_000, 60_000,
	]);
});
