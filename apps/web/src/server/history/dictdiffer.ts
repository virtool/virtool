/** Where a diff entry applies: a dot-joined string, or a list of keys and list indices. */
export type DiffPath = string | Array<string | number>;

/** One entry in a dictdiffer diff: the action, the path it applies at, and its changes. */
export type DiffEntry = [action: string, path: DiffPath, changes: unknown];

/** The `[key, value]` pairs an `add` or `remove` entry carries. */
type PairChanges = Array<[string | number, unknown]>;

/** The single `[before, after]` pair a `change` entry carries. */
type ChangePair = [unknown, unknown];

type Container = Record<string | number, unknown>;

function isEmptyPath(path: DiffPath | null | undefined): boolean {
	return (
		path === null ||
		path === undefined ||
		path === "" ||
		(Array.isArray(path) && path.length === 0)
	);
}

function toSegments(path: DiffPath): Array<string | number> {
	return typeof path === "string" ? path.split(".") : path;
}

function dotLookup(
	source: unknown,
	path: DiffPath | null | undefined,
	parent = false,
): unknown {
	if (isEmptyPath(path)) {
		return source;
	}

	const segments = toSegments(path as DiffPath);
	const keys = parent ? segments.slice(0, -1) : segments;

	let value = source;

	for (const key of keys) {
		// Python coerces a string segment to an int before indexing a list. A JS
		// array read accepts the numeric string as-is, so no coercion is needed
		// here — only where a write needs a real index (see `applyChange`).
		value = (value as Container)[key];
	}

	return value;
}

function applyAdd(
	destination: unknown,
	path: DiffPath,
	changes: unknown,
): void {
	for (const [key, value] of changes as PairChanges) {
		// Re-resolved per pair, matching Python: an insert can replace the
		// container a later pair in the same entry targets.
		const target = dotLookup(destination, path);

		if (Array.isArray(target)) {
			target.splice(Number(key), 0, value);
		} else {
			(target as Container)[key] = value;
		}
	}
}

function applyRemove(
	destination: unknown,
	path: DiffPath,
	changes: unknown,
): void {
	for (const [key] of changes as PairChanges) {
		const target = dotLookup(destination, path);

		if (Array.isArray(target)) {
			target.splice(Number(key), 1);
		} else {
			delete (target as Container)[key];
		}
	}
}

function applyChange(
	destination: unknown,
	path: DiffPath,
	changes: unknown,
): void {
	const target = dotLookup(destination, path, true);
	const segments = toSegments(path);
	const last = segments[segments.length - 1];

	if (last === undefined) {
		throw new Error("Cannot apply a change entry at an empty path");
	}

	const [, after] = changes as ChangePair;

	(target as Container)[Array.isArray(target) ? Number(last) : last] = after;
}

function swapEntry([action, path, changes]: DiffEntry): DiffEntry {
	switch (action) {
		case "add":
			// The reversal is load-bearing: removing inserted list items in
			// forward order would shift the indices of those still to be removed.
			return ["remove", path, [...(changes as PairChanges)].reverse()];
		case "remove":
			return ["add", path, changes];
		case "change": {
			const [before, after] = changes as ChangePair;
			return ["change", path, [after, before]];
		}
		default:
			throw new Error(`Unknown dictdiffer action: ${action}`);
	}
}

/**
 * Invert a diff so that applying it walks a document backwards.
 *
 * `add` becomes `remove` with its changes reversed, `remove` becomes `add`,
 * and `change` swaps before and after.
 */
export function swap(diff: DiffEntry[]): DiffEntry[] {
	return diff.map(swapEntry);
}

/**
 * Apply a diff to a document, returning a patched copy.
 *
 * The destination is deep-cloned first, matching Python dictdiffer's
 * `in_place=False` default.
 */
export function patch<T>(diff: DiffEntry[], destination: T): T {
	const patched = structuredClone(destination);

	for (const [action, path, changes] of diff) {
		switch (action) {
			case "add":
				applyAdd(patched, path, changes);
				break;
			case "remove":
				applyRemove(patched, path, changes);
				break;
			case "change":
				applyChange(patched, path, changes);
				break;
			default:
				throw new Error(`Unknown dictdiffer action: ${action}`);
		}
	}

	return patched;
}
