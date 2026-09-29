import { accountQueryKeys } from "@account/keys";
import { QueryClient } from "@tanstack/react-query";
import { recentAuthenticationServerFnMocks } from "@tests/server-fn/recentAuthentication";
import { describe, expect, it, vi } from "vitest";
import { resolveRecentAuthenticationFresh } from "../recentAuthentication";

vi.mock("@tanstack/react-query", async (importOriginal) => ({
	...(await importOriginal<typeof import("@tanstack/react-query")>()),
	isServer: true,
}));

describe("resolveRecentAuthenticationFresh on the server", () => {
	it("answers without caching a server-clock deadline", async () => {
		recentAuthenticationServerFnMocks.getRecentAuthenticationRemainingFn.mockResolvedValue(
			60_000,
		);
		const queryClient = new QueryClient();

		await expect(resolveRecentAuthenticationFresh(queryClient)).resolves.toBe(
			true,
		);
		expect(
			queryClient.getQueryData(accountQueryKeys.recentAuthentication()),
		).toBeUndefined();
	});

	it("reports an expired session as not fresh", async () => {
		recentAuthenticationServerFnMocks.getRecentAuthenticationRemainingFn.mockResolvedValue(
			0,
		);

		await expect(
			resolveRecentAuthenticationFresh(new QueryClient()),
		).resolves.toBe(false);
	});
});
