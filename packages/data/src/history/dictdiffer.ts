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

function isRecord(value: unknown): value is Container {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNumeric(value: unknown): value is number | boolean {
	// Python's `num_types` is `(int, float)`, and `bool` subclasses `int`, so
	// `True == 1` there.
	return typeof value === "number" || typeof value === "boolean";
}

function areDifferent(first: unknown, second: unknown): boolean {
	if (first === second) {
		return false;
	}

	if (isNumeric(first) && isNumeric(second)) {
		// `math.isclose(a, b, rel_tol=sys.float_info.epsilon, abs_tol=0)`, the
		// default `tolerance` dictdiffer is called with.
		const a = Number(first);
		const b = Number(second);

		return (
			Math.abs(a - b) > Number.EPSILON * Math.max(Math.abs(a), Math.abs(b))
		);
	}

	// Python also counts two NaNs as equal and compares sets, numpy arrays and
	// Decimals. None of those survives a JSONB round trip, so none is ported.
	return true;
}

function toPath(node: Array<string | number>): DiffPath {
	// `dot_notation=True`, dictdiffer's default and the only way Virtool calls
	// it. A path is only dot-joined when every key is a string that has no dot
	// of its own to be confused with the separator.
	if (node.every((key) => typeof key === "string" && !key.includes("."))) {
		return node.join(".");
	}

	return [...node];
}

function range(start: number, end: number): number[] {
	return Array.from({ length: Math.max(end - start, 0) }, (_, i) => start + i);
}

function diffRecursive(
	first: unknown,
	second: unknown,
	node: Array<string | number>,
	entries: DiffEntry[],
): void {
	const path = toPath(node);

	let intersection: Array<string | number>;
	let addition: Array<string | number>;
	let deletion: Array<string | number>;

	if (isRecord(first) && isRecord(second)) {
		intersection = Object.keys(first).filter((key) =>
			Object.hasOwn(second, key),
		);
		addition = Object.keys(second).filter((key) => !Object.hasOwn(first, key));
		deletion = Object.keys(first).filter((key) => !Object.hasOwn(second, key));
	} else if (Array.isArray(first) && Array.isArray(second)) {
		const shared = Math.min(first.length, second.length);

		intersection = range(0, shared);
		addition = range(shared, second.length);
		// Reversed so that a patch removes the highest index first and never
		// shifts an index it has yet to reach.
		deletion = range(shared, first.length).reverse();
	} else {
		// Either a scalar pair, or a container whose type changed — dictdiffer
		// does not recurse into a type change, it reports the whole value.
		if (areDifferent(first, second)) {
			entries.push([
				"change",
				path,
				[structuredClone(first), structuredClone(second)],
			]);
		}

		return;
	}

	const firstContainer = first as Container;
	const secondContainer = second as Container;

	for (const key of intersection) {
		diffRecursive(
			firstContainer[key],
			secondContainer[key],
			[...node, key],
			entries,
		);
	}

	if (addition.length > 0) {
		const changes: PairChanges = addition.map((key) => [
			key,
			structuredClone(secondContainer[key]),
		]);

		entries.push(["add", path, changes]);
	}

	if (deletion.length > 0) {
		const changes: PairChanges = deletion.map((key) => [
			key,
			structuredClone(firstContainer[key]),
		]);

		entries.push(["remove", path, changes]);
	}
}

/**
 * Compare two documents, returning the diff that turns the first into the second.
 *
 * Python's generator is materialised as an array, since Virtool only ever
 * consumes it as `list(dictdiffer.diff(old, new))`. The `ignore`, `path_limit`
 * and `expand` options are not ported — every call site takes the defaults.
 */
export function diff(first: unknown, second: unknown): DiffEntry[] {
	const entries: DiffEntry[] = [];

	diffRecursive(first, second, [], entries);

	return entries;
}
