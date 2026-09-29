import { bannerQueryKeys } from "@banner/keys";
import type { QueryClient } from "@tanstack/react-query";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createFakeAccount } from "@tests/fake/account";
import { createFakeSettings } from "@tests/fake/administrator";
import { recentAuthenticationServerFnMocks } from "@tests/server-fn/recentAuthentication";
import { mockSettingsStore } from "@tests/server-fn/settings";
import { renderRoute } from "@tests/setup";
import { describe, expect, it } from "vitest";

const account = createFakeAccount({ administratorRole: "full" });

function seedBanners(queryClient: QueryClient) {
	queryClient.setQueryData(bannerQueryKeys.lists(), []);
}

describe("administration recent-authentication gate", () => {
	it("checks freshness once across administration navigations", async () => {
		mockSettingsStore(createFakeSettings());
		const { router } = await renderRoute("/administration/banners", {
			account,
			seed: seedBanners,
		});

		expect(
			await screen.findByRole("heading", { name: "Banners" }),
		).toBeInTheDocument();

		await router.navigate({ to: "/administration/uploads" });

		expect(
			await screen.findByRole("heading", { name: "Uploads" }),
		).toBeInTheDocument();
		expect(
			recentAuthenticationServerFnMocks.getRecentAuthenticationRemainingFn,
		).toHaveBeenCalledTimes(1);
	});

	it("opens administration after the challenge passes", async () => {
		const remaining =
			recentAuthenticationServerFnMocks.getRecentAuthenticationRemainingFn;
		remaining.mockResolvedValueOnce(0);
		recentAuthenticationServerFnMocks.getRecentAuthenticationMethodsFn.mockResolvedValue(
			{ password: true, totp: false },
		);
		recentAuthenticationServerFnMocks.challengeRecentAuthenticationFn.mockResolvedValue(
			{ createdAt: new Date(), sessionId: 2 },
		);

		await renderRoute("/administration/banners", {
			account,
			seed: seedBanners,
		});

		expect(
			await screen.findByRole("heading", { name: "Confirm your identity" }),
		).toBeInTheDocument();

		await userEvent.type(screen.getByLabelText("Password"), "password");
		await userEvent.click(screen.getByRole("button", { name: "Continue" }));

		expect(
			await screen.findByRole("heading", { name: "Banners" }),
		).toBeInTheDocument();
		await waitFor(() => {
			expect(remaining).toHaveBeenCalledTimes(2);
		});
	});
});
