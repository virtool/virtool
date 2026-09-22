import { isIP } from "node:net";
import type { BetterAuthOptions } from "better-auth";
import { getIp } from "better-auth/api";

const UNKNOWN_BROWSER = "Unknown browser";
const UNKNOWN_OPERATING_SYSTEM = "Unknown operating system";
const MAX_USER_AGENT_LENGTH = 512;

/** IP address resolution shared by Better Auth and restricted sessions. */
export const AUTH_IP_ADDRESS_OPTIONS = {
	ipAddressHeaders: ["cf-connecting-ip", "x-forwarded-for"],
} satisfies NonNullable<
	NonNullable<BetterAuthOptions["advanced"]>["ipAddress"]
>;

/** Bounded metadata stored with a browser session for recognition only. */
export type BrowserSessionMetadata = {
	ipAddress: string | null;
	userAgent: string | null;
};

/** Display labels derived from a browser session's user agent. */
export type BrowserSessionDisplay = {
	browser: string;
	operatingSystem: string;
};

function clean(value: string, maximumLength: number): string {
	const withoutControls = Array.from(value, (character) => {
		const code = character.charCodeAt(0);
		return code <= 31 || (code >= 127 && code <= 159) ? " " : character;
	}).join("");
	return withoutControls.replace(/\s+/g, " ").trim().slice(0, maximumLength);
}

function formatVersion(version: string): string {
	return version.replaceAll("_", ".").split(".").slice(0, 2).join(".");
}

function matchDisplay(
	userAgent: string,
	patterns: ReadonlyArray<readonly [RegExp, string]>,
	fallback: string,
): string {
	for (const [pattern, name] of patterns) {
		const match = pattern.exec(userAgent);
		if (match) {
			const version = match[1];
			return version ? `${name} ${formatVersion(version)}` : name;
		}
	}
	return fallback;
}

function getBrowser(userAgent: string): string {
	return matchDisplay(
		userAgent,
		[
			[/Edg(?:A|iOS)?\/([\d.]+)/, "Edge"],
			[/OPR\/([\d.]+)/, "Opera"],
			[/Firefox\/([\d.]+)/, "Firefox"],
			[/FxiOS\/([\d.]+)/, "Firefox"],
			[/CriOS\/([\d.]+)/, "Chrome"],
			[/Chrome\/([\d.]+)/, "Chrome"],
			[/Version\/([\d.]+).*Safari\//, "Safari"],
		],
		UNKNOWN_BROWSER,
	);
}

function getOperatingSystem(userAgent: string): string {
	return matchDisplay(
		userAgent,
		[
			[/Windows NT (?:10\.0|6\.[1-3])/, "Windows"],
			[/Android ([\d.]+)/, "Android"],
			[/iPhone OS ([\d_]+)/, "iOS"],
			[/iPad; CPU OS ([\d_]+)/, "iPadOS"],
			[/Mac OS X ([\d_]+)/, "macOS"],
			[/CrOS [^ ]+ ([\d.]+)/, "ChromeOS"],
			[/Linux/, "Linux"],
		],
		UNKNOWN_OPERATING_SYSTEM,
	);
}

/** Resolve the same proxy headers used by Virtool's other session issuers. */
export function getClientIpFromHeaders(headers: Headers): string | null {
	return getIp(headers, {
		advanced: { ipAddress: AUTH_IP_ADDRESS_OPTIONS },
	});
}

/** Validate one stored session IP before publishing it. */
export function normalizeSessionIpAddress(value: unknown): string | null {
	const normalized = typeof value === "string" ? clean(value, 45) : null;
	return normalized && isIP(normalized) !== 0 ? normalized : null;
}

/** Derive bounded display labels from a stored user agent. */
export function getBrowserSessionDisplay(
	userAgent: string | null,
): BrowserSessionDisplay {
	return {
		browser: userAgent ? getBrowser(userAgent) : UNKNOWN_BROWSER,
		operatingSystem: userAgent
			? getOperatingSystem(userAgent)
			: UNKNOWN_OPERATING_SYSTEM,
	};
}

/** Normalize untrusted request metadata into bounded session storage fields. */
export function normalizeBrowserSessionMetadata(
	headers: Headers | null | undefined,
	fallback: { ipAddress?: unknown; userAgent?: unknown } = {},
): BrowserSessionMetadata {
	const rawUserAgent =
		typeof fallback.userAgent === "string"
			? fallback.userAgent
			: (headers?.get("user-agent") ?? "");
	const userAgent = clean(rawUserAgent, MAX_USER_AGENT_LENGTH);
	const ipAddress = headers
		? getClientIpFromHeaders(headers)
		: normalizeSessionIpAddress(fallback.ipAddress);

	return {
		ipAddress,
		userAgent: userAgent || null,
	};
}
