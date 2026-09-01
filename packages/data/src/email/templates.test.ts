import type { EmailTemplate } from "@virtool/contracts";
import { describe, expect, it } from "vitest";
import { renderEmailTemplate } from "./templates";

const linkTemplates: EmailTemplate[] = [
	{
		type: "account_setup",
		username: "alice",
		setupUrl: "https://virtool.example/setup?token=abc",
	},
	{
		type: "email_verification",
		username: "alice",
		verifyUrl: "https://virtool.example/verify?token=abc",
	},
	{
		type: "password_recovery",
		username: "alice",
		recoveryUrl: "https://virtool.example/recover?token=abc",
	},
];

describe("renderEmailTemplate", () => {
	it.each(linkTemplates.map((template) => [template.type, template] as const))(
		"renders %s with a subject and both bodies",
		(_, template) => {
			const rendered = renderEmailTemplate(template);

			expect(rendered.subject).not.toBe("");
			expect(rendered.text).toContain("alice");
			expect(rendered.text).toContain("token=abc");
			expect(rendered.html).toContain("<a href=");
		},
	);

	it("renders the test template with both bodies", () => {
		const rendered = renderEmailTemplate({ type: "test" });

		expect(rendered.subject).toContain("test");
		expect(rendered.text).not.toBe("");
		expect(rendered.html).toContain("<p>");
	});

	it("escapes untrusted values in the HTML body", () => {
		const rendered = renderEmailTemplate({
			type: "account_setup",
			username: '<script>alert("x")</script>',
			setupUrl: 'https://virtool.example/"><script>alert(1)</script>',
		});

		expect(rendered.html).not.toContain("<script>");
		expect(rendered.html).toContain("&lt;script&gt;");
		expect(rendered.html).not.toContain('"><script>');
	});

	it("leaves the text body unescaped", () => {
		const rendered = renderEmailTemplate({
			type: "account_setup",
			username: "a&b",
			setupUrl: "https://virtool.example/setup?a=1&b=2",
		});

		expect(rendered.text).toContain("a&b");
		expect(rendered.text).toContain("a=1&b=2");
	});
});
