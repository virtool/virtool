import { useLocation } from "@tanstack/react-router";

/**
 * Whether a pathname is at or under a path, ignoring the path's query and
 * trailing slashes. A pathname in `exclude` never matches.
 */
export function matchPartialPath(
	pathname: string,
	path: string,
	exclude?: string[],
): boolean {
	if (exclude?.includes(pathname)) {
		return false;
	}

	const normalizedPath = (path.split("?")[0] ?? "").replace(/\/+$/, "") || "/";
	return (
		pathname === normalizedPath || pathname.startsWith(`${normalizedPath}/`)
	);
}

export function useMatchPartialPath(path: string, exclude?: string[]): boolean {
	const pathname = useLocation({ select: (l) => l.pathname });

	return matchPartialPath(pathname, path, exclude);
}
