import { describe, expect, it } from "vitest";
import { matchPartialPath } from "../useMatchPartialPath";

describe("matchPartialPath()", () => {
	it.each<[string, string, string, string[] | undefined, boolean]>([
		[
			"a pathname under the path",
			"/samples/abc123",
			"/samples",
			undefined,
			true,
		],
		["an exact match", "/samples", "/samples", undefined, true],
		[
			"a pathname outside the path",
			"/refs/abc123",
			"/samples",
			undefined,
			false,
		],
		[
			"a path with a trailing slash",
			"/samples/abc123",
			"/samples/",
			undefined,
			true,
		],
		[
			"a path with a query",
			"/samples/abc123",
			"/samples?page=1",
			undefined,
			true,
		],
		[
			"an excluded pathname",
			"/refs/settings",
			"/refs",
			["/refs/settings"],
			false,
		],
		[
			"a pathname that is not excluded",
			"/refs/abc123",
			"/refs",
			["/refs/settings"],
			true,
		],
		["a partial segment", "/samples", "/sample", undefined, false],
		[
			"the root path against another pathname",
			"/samples",
			"/",
			undefined,
			false,
		],
		["the root path exactly", "/", "/", undefined, true],
	])("should decide for %s", (_, pathname, path, exclude, expected) => {
		expect(matchPartialPath(pathname, path, exclude)).toBe(expected);
	});
});
