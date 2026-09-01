// Central rendering for every transactional email template.
//
// Callers hand over a typed payload and never markup, so escaping happens in
// exactly one place. Every template renders both a text and an HTML body.

import type { EmailTemplate } from "@virtool/contracts";

/**
 * The template revision stamped onto queued rows.
 *
 * Bump when a template's required payload changes shape, so a retry of a row
 * queued before the change is renderable — or rejectable — on sight.
 */
export const EMAIL_TEMPLATE_VERSION = 1;

/** A rendered message: subject line plus text and HTML bodies. */
export type RenderedEmail = {
	html: string;
	subject: string;
	text: string;
};

function escapeHtml(value: string): string {
	return value
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;")
		.replaceAll("'", "&#39;");
}

function renderLinkEmail(
	subject: string,
	greeting: string,
	instruction: string,
	url: string,
	expiryNote: string,
): RenderedEmail {
	const safeUrl = escapeHtml(url);

	return {
		subject,
		text: `${greeting}\n\n${instruction}\n\n${url}\n\n${expiryNote}\n`,
		html: [
			`<p>${escapeHtml(greeting)}</p>`,
			`<p>${escapeHtml(instruction)}</p>`,
			`<p><a href="${safeUrl}">${safeUrl}</a></p>`,
			`<p>${escapeHtml(expiryNote)}</p>`,
		].join("\n"),
	};
}

/** Render `template` into a subject and both bodies, escaping every payload value. */
export function renderEmailTemplate(template: EmailTemplate): RenderedEmail {
	switch (template.type) {
		case "account_setup":
			return renderLinkEmail(
				"Set up your Virtool account",
				`Hello ${template.username},`,
				"An administrator invited you to Virtool. Open this link to set up your account:",
				template.setupUrl,
				"If you did not expect this invitation, you can ignore this email.",
			);

		case "email_verification":
			return renderLinkEmail(
				"Verify your email address",
				`Hello ${template.username},`,
				"Open this link to verify the email address on your Virtool account:",
				template.verifyUrl,
				"If you did not request this, you can ignore this email.",
			);

		case "password_recovery":
			return renderLinkEmail(
				"Reset your Virtool password",
				`Hello ${template.username},`,
				"Open this link to reset the password on your Virtool account:",
				template.recoveryUrl,
				"If you did not request a reset, you can ignore this email and your password stays unchanged.",
			);

		case "test": {
			const body =
				"This is a test message from your Virtool instance. Email delivery is configured correctly.";

			return {
				subject: "Virtool email delivery test",
				text: `${body}\n`,
				html: `<p>${escapeHtml(body)}</p>`,
			};
		}
	}
}
