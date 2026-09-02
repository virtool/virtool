import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createFakeEmailSettings } from "@tests/fake/email";
import {
	emailServerFnMocks,
	mockEmailSettingsStore,
} from "@tests/server-fn/email";
import { renderWithProviders } from "@tests/setup";
import { describe, expect, it } from "vitest";

const { default: EmailDelivery } = await import("../EmailDelivery");

function findStatus() {
	return screen.findByRole("status", { name: "email delivery status" });
}

describe("<EmailDelivery>", () => {
	it("shows a loader while the configuration is pending", () => {
		emailServerFnMocks.getEmailSettingsFn.mockReturnValue(
			new Promise(() => undefined),
		);

		renderWithProviders(<EmailDelivery />);

		expect(screen.getByRole("status", { name: "loading" })).toBeInTheDocument();
	});

	it("shows an error when the configuration cannot be read", async () => {
		emailServerFnMocks.getEmailSettingsFn.mockRejectedValue(
			new Error("Forbidden"),
		);

		renderWithProviders(<EmailDelivery />);

		expect(
			await screen.findByText(/couldn't load email settings/i),
		).toBeVisible();
	});

	describe("availability", () => {
		it("reports a ready instance", async () => {
			mockEmailSettingsStore(createFakeEmailSettings());

			renderWithProviders(<EmailDelivery />);

			expect(await findStatus()).toHaveTextContent("Active");
		});

		it("reports a configured instance even when sending is switched off", async () => {
			mockEmailSettingsStore(createFakeEmailSettings({ enabled: false }));

			renderWithProviders(<EmailDelivery />);

			expect(await findStatus()).toHaveTextContent("Disabled");
			expect(
				screen.getByText("Turn on this setting to send email."),
			).toBeVisible();
		});

		it("names the fields an unconfigured instance is missing", async () => {
			mockEmailSettingsStore(
				createFakeEmailSettings({
					availability: "unconfigured",
					enabled: false,
					hasApiKey: false,
					senderAddress: "",
				}),
			);

			renderWithProviders(<EmailDelivery />);

			expect(await findStatus()).toHaveTextContent(
				"needs an API key and a sender address",
			);
		});

		// A key that cannot be decrypted is intact. Reporting it as missing would
		// point an administrator at the API key when the encryption key is at
		// fault, and invite them to overwrite a value that is still good.
		it("never reports an undecryptable key as a missing one", async () => {
			mockEmailSettingsStore(
				createFakeEmailSettings({
					availability: "configuration_error",
					enabled: false,
				}),
			);

			renderWithProviders(<EmailDelivery />);

			const status = await findStatus();

			expect(status).toHaveTextContent("Configuration Error");
			expect(status).toHaveTextContent("has not been changed");
			expect(status).not.toHaveTextContent("needs an API key");
		});
	});

	describe("the send switch", () => {
		it("turns delivery on for a configuration the server has resolved", async () => {
			const { updateEmailSettings } = mockEmailSettingsStore(
				createFakeEmailSettings({ enabled: false }),
			);

			renderWithProviders(<EmailDelivery />);

			await userEvent.click(
				await screen.findByRole("switch", { name: "Send email" }),
			);

			await waitFor(() => {
				expect(updateEmailSettings).toHaveBeenCalledWith({
					data: { enabled: true },
				});
			});
		});

		it("cannot be turned on while the configuration is incomplete", async () => {
			mockEmailSettingsStore(
				createFakeEmailSettings({
					availability: "unconfigured",
					enabled: false,
					hasApiKey: false,
					senderAddress: "",
				}),
			);

			renderWithProviders(<EmailDelivery />);

			expect(
				await screen.findByRole("switch", { name: "Send email" }),
			).toBeDisabled();
		});

		it("can always be turned off", async () => {
			const { updateEmailSettings } = mockEmailSettingsStore(
				createFakeEmailSettings(),
			);

			renderWithProviders(<EmailDelivery />);

			await userEvent.click(
				await screen.findByRole("switch", { name: "Send email" }),
			);

			await waitFor(() => {
				expect(updateEmailSettings).toHaveBeenCalledWith({
					data: { enabled: false },
				});
			});
		});
	});

	describe("the sender identity", () => {
		it("shows the sender section", async () => {
			mockEmailSettingsStore(createFakeEmailSettings());

			renderWithProviders(<EmailDelivery />);

			expect(
				await screen.findByRole("heading", { name: "Sender" }),
			).toBeVisible();
		});

		it("saves the fields the server last returned", async () => {
			const { updateEmailSettings } = mockEmailSettingsStore(
				createFakeEmailSettings(),
			);

			renderWithProviders(<EmailDelivery />);

			await userEvent.type(
				await screen.findByLabelText(/Reply-To Address/),
				"support@virtool.example",
			);
			await userEvent.click(screen.getByRole("button", { name: "Save" }));

			await waitFor(() => {
				expect(updateEmailSettings).toHaveBeenCalledWith({
					data: {
						replyToAddress: "support@virtool.example",
						senderAddress: "noreply@virtool.example",
						senderName: "Virtool",
					},
				});
			});
		});

		it("refuses a malformed sender address", async () => {
			const { updateEmailSettings } = mockEmailSettingsStore(
				createFakeEmailSettings(),
			);

			renderWithProviders(<EmailDelivery />);

			const senderAddress = await screen.findByLabelText("Sender Address");
			await userEvent.clear(senderAddress);
			await userEvent.type(senderAddress, "nope");
			await userEvent.click(screen.getByRole("button", { name: "Save" }));

			expect(await screen.findByText("Invalid email address.")).toBeVisible();
			expect(updateEmailSettings).not.toHaveBeenCalled();
		});

		it("accepts an empty reply-to address", async () => {
			const { updateEmailSettings } = mockEmailSettingsStore(
				createFakeEmailSettings({ replyToAddress: "support@virtool.example" }),
			);

			renderWithProviders(<EmailDelivery />);

			await userEvent.clear(await screen.findByLabelText(/Reply-To Address/));
			await userEvent.click(screen.getByRole("button", { name: "Save" }));

			await waitFor(() => {
				expect(updateEmailSettings).toHaveBeenCalledWith({
					data: expect.objectContaining({ replyToAddress: "" }),
				});
			});
		});
	});

	describe("the API key", () => {
		it("starts empty and says a key is configured", async () => {
			mockEmailSettingsStore(createFakeEmailSettings());

			renderWithProviders(<EmailDelivery />);

			const input = await screen.findByLabelText("Resend API Key");

			expect(input).toHaveValue("");
			expect(screen.getByText("A key is configured.")).toBeVisible();
			expect(screen.getByRole("button", { name: "Replace Key" })).toBeVisible();
		});

		it("says no key is configured when none is", async () => {
			mockEmailSettingsStore(
				createFakeEmailSettings({
					availability: "unconfigured",
					enabled: false,
					hasApiKey: false,
				}),
			);

			renderWithProviders(<EmailDelivery />);

		expect(await screen.findByText("No key is configured.")).toBeVisible();
			expect(
				screen.queryByRole("button", { name: "Remove" }),
			).not.toBeInTheDocument();
		});

		it("stores a typed key and clears the field", async () => {
			const { setEmailApiKey } = mockEmailSettingsStore(
				createFakeEmailSettings({
					availability: "unconfigured",
					enabled: false,
					hasApiKey: false,
				}),
			);

			renderWithProviders(<EmailDelivery />);

			const input = await screen.findByLabelText("Resend API Key");
			await userEvent.type(input, "  re_secret  ");
			await userEvent.click(screen.getByRole("button", { name: "Save Key" }));

			await waitFor(() => {
				expect(setEmailApiKey).toHaveBeenCalledWith({
					data: { apiKey: "re_secret" },
				});
			});

			await waitFor(() => expect(input).toHaveValue(""));
		});

		it("refuses to submit an empty field, so a blank cannot clear the key", async () => {
			const { clearEmailApiKey, setEmailApiKey } = mockEmailSettingsStore(
				createFakeEmailSettings(),
			);

			renderWithProviders(<EmailDelivery />);

			await userEvent.click(
				await screen.findByRole("button", { name: "Replace Key" }),
			);

			expect(await screen.findByText("An API key is required.")).toBeVisible();
			expect(setEmailApiKey).not.toHaveBeenCalled();
			expect(clearEmailApiKey).not.toHaveBeenCalled();
		});

		it("refuses to submit a whitespace-only key", async () => {
			const { setEmailApiKey } = mockEmailSettingsStore(
				createFakeEmailSettings(),
			);

			renderWithProviders(<EmailDelivery />);

			await userEvent.type(
				await screen.findByLabelText("Resend API Key"),
				"   ",
			);
			await userEvent.click(
				screen.getByRole("button", { name: "Replace Key" }),
			);

			expect(await screen.findByText("An API key is required.")).toBeVisible();
			expect(setEmailApiKey).not.toHaveBeenCalled();
		});

		it("confirms before removing a stored key", async () => {
			const { clearEmailApiKey } = mockEmailSettingsStore(
				createFakeEmailSettings(),
			);

			renderWithProviders(<EmailDelivery />);

			await userEvent.click(
				await screen.findByRole("button", { name: "Remove" }),
			);

			const dialog = await screen.findByRole("alertdialog");

			expect(dialog).toHaveTextContent("cannot be recovered");
			expect(clearEmailApiKey).not.toHaveBeenCalled();

			await userEvent.click(
				within(dialog).getByRole("button", { name: "Confirm" }),
			);

			await waitFor(() => expect(clearEmailApiKey).toHaveBeenCalled());
		});
	});

	describe("test delivery", () => {
		it("shows the test widget under sending", async () => {
			mockEmailSettingsStore(createFakeEmailSettings());

			renderWithProviders(<EmailDelivery />);

			expect(await screen.findByText("Test")).toBeVisible();
		});

		it("reports acceptance without claiming the message arrived", async () => {
			mockEmailSettingsStore(createFakeEmailSettings());
			emailServerFnMocks.sendTestEmailFn.mockResolvedValue({
				ok: true,
				providerMessageId: "msg_1",
			});

			renderWithProviders(<EmailDelivery />);

			await userEvent.type(
				await screen.findByLabelText("Email Address"),
				"someone@example.com",
			);
			await userEvent.click(screen.getByRole("button", { name: "Send" }));

			await waitFor(() => {
				expect(emailServerFnMocks.sendTestEmailFn).toHaveBeenCalledWith({
					data: { recipient: "someone@example.com" },
				});
			});

			expect(
				await screen.findByText(/Resend accepted the test message/),
			).toBeVisible();
		});

		it("words a bounded failure code itself", async () => {
			mockEmailSettingsStore(createFakeEmailSettings());
			emailServerFnMocks.sendTestEmailFn.mockResolvedValue({
				ok: false,
				code: "invalid_sender",
			});

			renderWithProviders(<EmailDelivery />);

			await userEvent.type(
				await screen.findByLabelText("Email Address"),
				"someone@example.com",
			);
			await userEvent.click(screen.getByRole("button", { name: "Send" }));

			expect(
				await screen.findByText(/Resend rejected the sender address/),
			).toBeVisible();
		});

		it("keeps the recipient after a failure so it can be retried", async () => {
			mockEmailSettingsStore(createFakeEmailSettings());
			emailServerFnMocks.sendTestEmailFn.mockResolvedValue({
				ok: false,
				code: "rate_limited",
			});

			renderWithProviders(<EmailDelivery />);

			const input = await screen.findByLabelText("Email Address");
			await userEvent.type(input, "someone@example.com");
			await userEvent.click(screen.getByRole("button", { name: "Send" }));

			await screen.findByText(/rate limiting/);

			expect(input).toHaveValue("someone@example.com");
		});

		it("refuses a malformed recipient without calling the server", async () => {
			mockEmailSettingsStore(createFakeEmailSettings());

			renderWithProviders(<EmailDelivery />);

			await userEvent.type(
				await screen.findByLabelText("Email Address"),
				"nope",
			);
			await userEvent.click(screen.getByRole("button", { name: "Send" }));

			expect(await screen.findByText("Invalid email address.")).toBeVisible();
			expect(emailServerFnMocks.sendTestEmailFn).not.toHaveBeenCalled();
		});

		it("trims a pasted recipient before validating and sending", async () => {
			mockEmailSettingsStore(createFakeEmailSettings());
			emailServerFnMocks.sendTestEmailFn.mockResolvedValue({
				ok: true,
				providerMessageId: "msg_1",
			});

			renderWithProviders(<EmailDelivery />);

			await userEvent.type(
				await screen.findByLabelText("Email Address"),
				" someone@example.com ",
			);
			await userEvent.click(screen.getByRole("button", { name: "Send" }));

			await waitFor(() => {
				expect(emailServerFnMocks.sendTestEmailFn).toHaveBeenCalledWith({
					data: { recipient: "someone@example.com" },
				});
			});
		});

		it("clears an earlier test result after sender settings are saved", async () => {
			mockEmailSettingsStore(createFakeEmailSettings());
			emailServerFnMocks.sendTestEmailFn.mockResolvedValue({
				ok: true,
				providerMessageId: "msg_1",
			});

			renderWithProviders(<EmailDelivery />);

			await userEvent.type(
				await screen.findByLabelText("Email Address"),
				"someone@example.com",
			);
			await userEvent.click(screen.getByRole("button", { name: "Send" }));
			expect(
				await screen.findByText(/Resend accepted the test message/),
			).toBeVisible();

			await userEvent.clear(screen.getByLabelText("Sender Name"));
			await userEvent.type(screen.getByLabelText("Sender Name"), "New Name");
			await userEvent.click(screen.getByRole("button", { name: "Save" }));

			await waitFor(() => {
				expect(
					screen.queryByText(/Resend accepted the test message/),
				).not.toBeInTheDocument();
			});
		});

		// Sending works while delivery is switched off — validating the
		// configuration before turning it on is the point of the test message.
		it("is available while delivery is switched off", async () => {
			mockEmailSettingsStore(createFakeEmailSettings({ enabled: false }));

			renderWithProviders(<EmailDelivery />);

			expect(await screen.findByLabelText("Email Address")).toBeEnabled();
			expect(screen.getByRole("button", { name: "Send" })).toBeEnabled();
		});

		it("is unavailable while the stored key cannot be used", async () => {
			mockEmailSettingsStore(
				createFakeEmailSettings({
					availability: "configuration_error",
					enabled: false,
				}),
			);

			renderWithProviders(<EmailDelivery />);

			expect(await screen.findByLabelText("Email Address")).toBeDisabled();
			expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
		});

		it("refuses a second submission while one is pending", async () => {
			mockEmailSettingsStore(createFakeEmailSettings());
			emailServerFnMocks.sendTestEmailFn.mockReturnValue(
				new Promise(() => undefined),
			);

			renderWithProviders(<EmailDelivery />);

			await userEvent.type(
				await screen.findByLabelText("Email Address"),
				"someone@example.com",
			);
			await userEvent.click(screen.getByRole("button", { name: "Send" }));

			const pending = await screen.findByRole("button", { name: "Sending" });

			expect(pending).toBeDisabled();
			await userEvent.click(pending);
			expect(emailServerFnMocks.sendTestEmailFn).toHaveBeenCalledTimes(1);
		});
	});
});
