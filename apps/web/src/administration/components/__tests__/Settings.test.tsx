import { bannerQueryKeys } from "@banner/keys";
import { screen, waitFor } from "@testing-library/react";
import { createFakeAccount } from "@tests/fake/account";
import { createFakeSettings } from "@tests/fake/administrator";
import { createFakeEmailSettings } from "@tests/fake/email";
import {
	emailServerFnMocks,
	mockEmailSettingsStore,
} from "@tests/server-fn/email";
import { mockSettingsStore } from "@tests/server-fn/settings";
import { renderRoute } from "@tests/setup";
import { describe, expect, it } from "vitest";

describe("<Settings />", () => {
	const path = "/administration/settings";

	it("should render", async () => {
		const account = createFakeAccount({ administratorRole: "full" });
		await renderRoute(path, {
			account,
			seed: (queryClient) => {
				queryClient.setQueryData(bannerQueryKeys.lists(), []);
			},
		});

		expect(await screen.findByText("Banners")).toBeInTheDocument();
		expect(screen.getByText("Settings")).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Create" })).toBeInTheDocument();
	});

	it("should render all options for full administrators", async () => {
		const account = createFakeAccount({ administratorRole: "full" });
		await renderRoute(path, { account });

		expect(await screen.findByText("Users")).toBeInTheDocument();
		expect(screen.getByText("Settings")).toBeInTheDocument();
		expect(screen.getByText("Groups")).toBeInTheDocument();
		expect(screen.queryByText("Administrators")).not.toBeInTheDocument();
	});

	it("should render only groups and users for users administrators", async () => {
		const account = createFakeAccount({ administratorRole: "users" });
		await renderRoute(path, { account });

		expect(await screen.findByText("Users")).toBeInTheDocument();
		expect(screen.queryByText("Settings")).not.toBeInTheDocument();
		expect(screen.queryByText("Administrators")).not.toBeInTheDocument();
		expect(screen.getByText("Groups")).toBeInTheDocument();
	});

	// Email configuration is recovery authority. Hiding the section is only
	// presentation — every server function behind it demands a full
	// administrator — but a lesser administrator should not send a request that
	// can only be refused.
	describe("email delivery", () => {
		it("is offered to a full administrator", async () => {
			mockSettingsStore(createFakeSettings());
			mockEmailSettingsStore(createFakeEmailSettings());

			await renderRoute(path, {
				account: createFakeAccount({ administratorRole: "full" }),
			});

			expect(await screen.findByText("Email Delivery")).toBeInTheDocument();
		});

		it("is absent for a settings administrator, and asks for nothing", async () => {
			mockSettingsStore(createFakeSettings());
			mockEmailSettingsStore(createFakeEmailSettings());

			await renderRoute(path, {
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
