// Full-page navigation. A browser does not let a test replace
// `window.location`, so code that reads or changes it goes through these
// functions, and tests mock this module.

/** Return the path and query string of the current page. */
export function getPagePath(): { pathname: string; search: string } {
	const { pathname, search } = window.location;
	return { pathname, search };
}

/** Load `url` as a new page. */
export function loadPage(url: string): void {
	window.location.assign(url);
}

/** Load the current page again. */
export function reloadPage(): void {
	window.location.reload();
}
