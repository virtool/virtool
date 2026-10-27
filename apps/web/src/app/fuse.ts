import Fuse from "fuse.js";
import { useMemo, useState } from "react";
import { normalizeSearchTerm } from "./search";

/**
 * Create a Fuse object.
 */
export function createFuse<T>(collection: T[], keys: string[]) {
	return new Fuse(collection, {
		keys,
		minMatchCharLength: 1,
		threshold: 0.3,
		useExtendedSearch: true,
	});
}

export function useFuse<T extends object>(
	collection: T[],
	keys: string[],
): [T[], string, (value: ((prevState: string) => string) | string) => void] {
	const [term, setTerm] = useState("");
	const [prevCollection, setPrevCollection] = useState(collection);

	if (collection !== prevCollection) {
		setPrevCollection(collection);
		setTerm("");
	}

	const fuse = useMemo(() => createFuse(collection, keys), [collection, keys]);

	const normalizedTerm = normalizeSearchTerm(term);
	const items = normalizedTerm
		? fuse.search(normalizedTerm).map((result) => result.item)
		: collection;

	return [items, term, setTerm];
}
