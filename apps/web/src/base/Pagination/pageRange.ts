import { range } from "es-toolkit/math";

/**
 * The page numbers to offer as buttons around the stored page.
 *
 * The window holds `leftButtons + rightButtons + 1` pages where there are that
 * many, and shifts at either end rather than shrinking.
 */
export function getPageRange(
	pageCount: number,
	storedPage: number,
	leftButtons = 1,
	rightButtons = 2,
): number[] {
	const totalButtons = leftButtons + rightButtons;
	let maxVal = Math.min(pageCount, storedPage + rightButtons);
	const minVal = Math.max(1, maxVal - totalButtons);
	maxVal = Math.min(pageCount, minVal + totalButtons);

	return range(minVal, maxVal + 1);
}
