import { isIP } from "node:net";

const UNKNOWN_BROWSER = "Unknown browser";
const UNKNOWN_OPERATING_SYSTEM = "Unknown operating system";
const MAX_USER_AGENT_LENGTH = 512;

/** Bounded metadata stored with a browser session for recognition only. */
export type BrowserSessionMetadata = {
	browser: string;
	operatingSystem: string;
	ipAddress: string | null;
	userAgent: string | null;
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

function normalizeBrowser(userAgent: string): string {
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

function normalizeOperatingSystem(userAgent: string): string {
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
	const value =
		headers.get("cf-connecting-ip") ??
		headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
		"";
	const normalized = clean(value, 45);
	return isIP(normalized) === 0 ? null : normalized;
}

/** Normalize untrusted request metadata into bounded session display fields. */
export function normalizeBrowserSessionMetadata(
	headers: Headers | null | undefined,
	fallback: { ipAddress?: unknown; userAgent?: unknown } = {},
): BrowserSessionMetadata {
	const rawUserAgent =
		typeof fallback.userAgent === "string"
			? fallback.userAgent
			: (headers?.get("user-agent") ?? "");
	const userAgent = clean(rawUserAgent, MAX_USER_AGENT_LENGTH);
	const fallbackIp =
		typeof fallback.ipAddress === "string"
			? clean(fallback.ipAddress, 45)
			: null;
	const ipAddress = headers
		? getClientIpFromHeaders(headers)
		: fallbackIp && isIP(fallbackIp) !== 0
			? fallbackIp
			: null;

	return {
		browser: userAgent ? normalizeBrowser(userAgent) : UNKNOWN_BROWSER,
		operatingSystem: userAgent
			? normalizeOperatingSystem(userAgent)
			: UNKNOWN_OPERATING_SYSTEM,
		ipAddress,
		userAgent: userAgent || null,
	};
}
