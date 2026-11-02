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

function parseLocal(value: string): URL | undefined {
	try {
		const url = new URL(value, BASE);
		return url.origin === BASE ? url : undefined;
	} catch {
		return undefined;
	}
}

function isWallPath(pathname: string): boolean {
	for (const path of WALL_PATHS) {
		if (pathname === path || pathname.startsWith(`${path}/`)) {
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

	const url = parseLocal(value);

	if (!url) {
		return undefined;
	}

	const { pathname, search, hash } = url;

	// Dot segments can normalize `/a/..//evil.com` to the protocol-relative
	// `//evil.com`.
	if (pathname.startsWith("//")) {
		return undefined;
	}

	// The email-change wall resumes a link that it holds in session storage.
	if (pathname === "/verify-email" && !search && !hash) {
		return pathname;
	}

	if (isWallPath(pathname)) {
		return undefined;
	}

	return `${pathname}${search}${hash}`;
}
