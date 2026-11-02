// A redirect to one of these would return to the wall after sign-in.
const WALL_PATHS = [
	"/login",
	"/setup",
	"/account-setup",
	"/recover",
	"/verify-email",
	"/email-remediation",
	"/email-remediation-verify",
	"/mfa-enrollment",
];

// A placeholder origin. Only a target that stays on it is local.
const BASE = "http://redirect.invalid";

// URL parsing reads a backslash as a slash and drops tabs and newlines, so
// `/\evil.com` would become the protocol-relative `//evil.com`.
function hasUnsafeCharacter(value: string): boolean {
	for (const character of value) {
		const code = character.charCodeAt(0);
		if (character === "\\" || code < 0x20 || code === 0x7f) {
			return true;
		}
	}
	return false;
}

/**
 * Return a normalized local post-authentication redirect, or discard it.
 *
 * Wall paths are discarded because sign-in would return to the wall.
 */
export function safeRedirect(value: unknown): string | undefined {
	if (
		typeof value !== "string" ||
		!value.startsWith("/") ||
		hasUnsafeCharacter(value)
	) {
		return undefined;
	}

	let url: URL;
	try {
		url = new URL(value, BASE);
	} catch {
		return undefined;
	}

	if (url.origin !== BASE) {
		return undefined;
	}

	const { pathname, search, hash } = url;

	// The email-change wall resumes a link that it holds in session storage.
	if (pathname === "/verify-email" && !search && !hash) {
		return pathname;
	}

	if (
		WALL_PATHS.some(
			(path) => pathname === path || pathname.startsWith(`${path}/`),
		)
	) {
		return undefined;
	}

	return `${pathname}${search}${hash}`;
}
