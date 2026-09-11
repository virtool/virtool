import { bannerQueryKeys } from "@banner/keys";
import { screen, waitFor } from "@testing-library/react";
import { createFakeAccount } from "@tests/fake/account";
import { createFakeSettings } from "@tests/fake/administrator";
import { createFakeEmailSettings } from "@tests/fake/email";
import {
	emailServerFnMocks,
	mockEmailSettingsStore,
} from "@tests/server-fn/email";
import {
	mockSettingsStore,
	settingsServerFnMocks,
} from "@tests/server-fn/settings";
import { mockFindUsers } from "@tests/server-fn/users";
import { renderRoute } from "@tests/setup";
import { describe, expect, it } from "vitest";

describe("<Settings />", () => {
	it("redirects the legacy settings route to banners", async () => {
		const account = createFakeAccount({ administratorRole: "full" });
		await renderRoute("/administration/settings", {
			account,
			seed: (queryClient) => {
				queryClient.setQueryData(bannerQueryKeys.lists(), []);
			},
		});

		expect(
			await screen.findByRole("heading", { name: "Banners" }),
		).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Create" })).toBeInTheDocument();
	});

	it("renders all navigation options for full administrators", async () => {
		const account = createFakeAccount({ administratorRole: "full" });
		await renderRoute("/administration/banners", { account });

		expect(await screen.findByText("Users")).toBeInTheDocument();
		expect(screen.getByText("Groups")).toBeInTheDocument();
		expect(screen.getByText("Caching")).toBeInTheDocument();
		expect(screen.getByText("Email Delivery")).toBeInTheDocument();
		expect(screen.getByText("NCBI")).toBeInTheDocument();
	});

	const settingsPages = [
		{
			path: "/administration/uploads",
			pageTitle: "Uploads",
			settingTitle: "Maximum Size",
			settingLevel: 3,
		},
		{
			path: "/administration/caching",
			pageTitle: "Caching",
			settingTitle: "Storage Budget",
			settingLevel: 3,
		},
		{
			path: "/administration/ncbi",
			pageTitle: "NCBI API Key",
			settingTitle: "NCBI API Key",
			settingLevel: 2,
		},
		{
			path: "/administration/email",
			pageTitle: "Email Delivery",
			settingTitle: "Email Delivery",
			settingLevel: 2,
		},
	];

	it.each(settingsPages)(
		"loads primary settings for $path",
		async ({ path, pageTitle, settingTitle, settingLevel }) => {
			mockSettingsStore(createFakeSettings());
			mockEmailSettingsStore(createFakeEmailSettings());

			await renderRoute(path, {
				account: createFakeAccount({ administratorRole: "full" }),
			});

			expect(
				await screen.findByRole("heading", {
					level: 2,
					name: pageTitle,
				}),
			).toBeVisible();
			expect(
				screen.getByRole("heading", {
					level: settingLevel,
					name: settingTitle,
				}),
			).toBeVisible();
		},
	);

	it.each(settingsPages)(
		"handles failed settings at the route boundary for $path",
		async ({ path }) => {
			settingsServerFnMocks.getSettingsFn.mockRejectedValue(
				new Error("Unavailable"),
			);
			settingsServerFnMocks.getCacheUsageFn.mockRejectedValue(
				new Error("Unavailable"),
			);
			emailServerFnMocks.getEmailSettingsFn.mockRejectedValue(
				new Error("Unavailable"),
			);

			await renderRoute(path, {
				account: createFakeAccount({ administratorRole: "full" }),
			});

			expect(
				await screen.findByRole("button", { name: "Try again" }),
			).toBeVisible();
		},
	);

	it.each(settingsPages)(
		"redirects users administrators before fetching $path",
		async ({ path }) => {
			mockFindUsers([]);
			const { router } = await renderRoute(path, {
				account: createFakeAccount({ administratorRole: "users" }),
			});

			expect(router.state.location.pathname).toBe("/administration/users");
			expect(settingsServerFnMocks.getSettingsFn).not.toHaveBeenCalled();
			expect(settingsServerFnMocks.getCacheUsageFn).not.toHaveBeenCalled();
			expect(emailServerFnMocks.getEmailSettingsFn).not.toHaveBeenCalled();
		},
	);

	// Email configuration is recovery authority. Hiding the section is only
	// presentation — every server function behind it demands a full
	// administrator — but a lesser administrator should not send a request that
	// can only be refused.
	describe("email delivery", () => {
		it("is offered to a full administrator", async () => {
			mockSettingsStore(createFakeSettings());
			mockEmailSettingsStore(createFakeEmailSettings());

			await renderRoute("/administration/email", {
				account: createFakeAccount({ administratorRole: "full" }),
			});

			expect(
				await screen.findByRole("heading", { name: "Email Delivery" }),
			).toBeInTheDocument();
		});

		it("is absent for a settings administrator, and asks for nothing", async () => {
			mockSettingsStore(createFakeSettings());
			mockEmailSettingsStore(createFakeEmailSettings());

			await renderRoute("/administration/ncbi", {
				account: createFakeAccount({ administratorRole: "settings" }),
			});

			expect(await screen.findByText("NCBI API Key")).toBeInTheDocument();
			expect(screen.queryByText("Email Delivery")).not.toBeInTheDocument();

			await waitFor(() => {
				expect(emailServerFnMocks.getEmailSettingsFn).not.toHaveBeenCalled();
			});
		});
	});
});
