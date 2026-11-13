/**
 * Return a `Storage` held in memory, for tests that run on Node, which has no
 * `sessionStorage`. Install it with `vi.stubGlobal("sessionStorage", ...)`.
 */
export function createMemoryStorage(): Storage {
	const items = new Map<string, string>();

	return {
		get length() {
			return items.size;
		},
		clear() {
			items.clear();
		},
		getItem(key) {
			return items.get(key) ?? null;
		},
		key(index) {
			return [...items.keys()][index] ?? null;
		},
		removeItem(key) {
			items.delete(key);
		},
		setItem(key, value) {
			items.set(key, String(value));
		},
	};
}
