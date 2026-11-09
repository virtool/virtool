import type {
	EmailLinkTemplate,
	EmailNoticeTemplate,
	EmailTemplate,
} from "@virtool/contracts";
import type { EncryptedValue, Keyring } from "../crypto/keyring";

const EMAIL_LINK_PURPOSE = "email_link";

/** The template field that holds the bearer link, by template type. */
const LINK_FIELDS = {
	account_setup: "setupUrl",
	email_verification: "verifyUrl",
	password_recovery: "recoveryUrl",
} as const;

type LinkField = (typeof LINK_FIELDS)[keyof typeof LINK_FIELDS];

type WithoutLink<T> = T extends EmailLinkTemplate ? Omit<T, LinkField> : never;

/** A template as the outbox stores it, with any bearer link removed. */
export type StoredEmailTemplate =
	| EmailNoticeTemplate
	| WithoutLink<EmailLinkTemplate>;

function isLinkType(
	type: EmailTemplate["type"],
): type is keyof typeof LINK_FIELDS {
	return type in LINK_FIELDS;
}

/** Split a template into its stored form and its encrypted link. */
export function sealEmailLink(
	keyring: Keyring,
	template: EmailLinkTemplate,
): { link: EncryptedValue; template: StoredEmailTemplate } | null {
	const field = LINK_FIELDS[template.type];
	const { [field]: url, ...stored } = template as EmailLinkTemplate &
		Record<LinkField, string>;
	const sealed = keyring.encrypt(EMAIL_LINK_PURPOSE, url);

	if (!sealed.ok) {
		return null;
	}

	return { link: sealed.value, template: stored as StoredEmailTemplate };
}

/**
 * Rebuild a renderable template, or return `null` if its link is unreadable.
 *
 * A link template with no envelope is unreadable, because rendering it would
 * send a message with no link.
 */
export function openEmailTemplate(
	keyring: Keyring,
	template: StoredEmailTemplate,
	link: EncryptedValue | null,
): EmailTemplate | null {
	if (!isLinkType(template.type)) {
		return template as EmailTemplate;
	}

	if (link === null) {
		return null;
	}

	const opened = keyring.decrypt(EMAIL_LINK_PURPOSE, link);

	return opened.ok
		? ({
				...template,
				[LINK_FIELDS[template.type]]: opened.plaintext,
			} as EmailTemplate)
		: null;
}
