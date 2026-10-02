import { bannerQueryKeys } from "@banner/keys";
import type { QueryClient } from "@tanstack/react-query";
import { screen } from "@testing-library/react";
import { createFakeAccount } from "@tests/fake/account";
import {
	accountServerFnMocks,
	mockFindActiveBrowserSessions,
	mockGetAccountSecurity,
} from "@tests/server-fn/account";
import { mockGetEmailDeliveryAvailable } from "@tests/server-fn/recovery";
import { renderRoute } from "@tests/setup";
import { beforeEach, describe, expect, it } from "vitest";

const account = createFakeAccount({ email: "alice@example.com" });

function seedBanners(queryClient: QueryClient) {
	queryClient.setQueryData(bannerQueryKeys.lists(), []);
}

describe("/account/security", () => {
	beforeEach(() => {
		mockGetEmailDeliveryAvailable(true);
		mockGetAccountSecurity({ pendingEmail: "new@example.com" });
		mockFindActiveBrowserSessions([]);
	});

	it("shows every sign-in control in one place", async () => {
		await renderRoute("/account/security", { account, seed: seedBanners });

		expect(
			await screen.findByRole("heading", { name: "Security" }),
		).toBeInTheDocument();
		for (const name of [
			"Email",
			"Password",
			"Two-factor authentication",
			"Passkeys",
			"Sessions",
		]) {
			expect(screen.getByRole("heading", { name })).toBeInTheDocument();
		}
		expect(await screen.findByText("new@example.com")).toBeInTheDocument();
		expect(screen.getByRole("link", { name: "Security" })).toHaveAttribute(
			"href",
			"/account/security",
		);
	});

	it("keeps the other sections when one fails to load", async () => {
		accountServerFnMocks.getAccountSecurityFn.mockRejectedValue(
			new Error("failed"),
		);

		await renderRoute("/account/security", { account, seed: seedBanners });

		expect(
			await screen.findByText("Couldn't load your two-factor authentication."),
		).toBeInTheDocument();
		expect(
			screen.getByText("Couldn't load your email address."),
		).toBeInTheDocument();
		expect(
			screen.getByRole("heading", { name: "Password" }),
		).toBeInTheDocument();
		expect(
			await screen.findByText("You are not signed in on other browsers."),
		).toBeInTheDocument();
	});
});
