/** Return the number of rows to skip before the first row of `page`. */
export function getPageOffset(page: number, perPage: number): number {
	return Math.max(page - 1, 0) * perPage;
}

/** Return the number of pages needed to show `foundCount` rows. */
export function getPageCount(foundCount: number, perPage: number): number {
	return perPage > 0 ? Math.ceil(foundCount / perPage) : 0;
}
