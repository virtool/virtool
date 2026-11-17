import { page } from "vitest/browser";

/**
 * Save a PNG of the page once its web fonts have loaded.
 *
 * The file goes to `apps/web/screenshots/`, under the shot file's name and the
 * test's name.
 *
 * @returns The absolute path of the saved PNG
 */
export async function takeShot(): Promise<string> {
	await document.fonts.ready;
	return page.screenshot();
}
