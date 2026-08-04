import { getRequestNow } from "@server/requestTime";
import { createIsomorphicFn } from "@tanstack/react-start";

/**
 * Name of the `<meta>` tag that carries the server's render instant to the
 * browser.
 */
export const SERVER_NOW_META_NAME = "vt-server-now";

// Read from the DOM once. The tag cannot change for the lifetime of a document,
// and this is called for every relative time on the page.
let readFromMeta: number | undefined;

function readNowFromMeta(): number {
	if (readFromMeta === undefined) {
		const content = document
			.querySelector(`meta[name="${SERVER_NOW_META_NAME}"]`)
			?.getAttribute("content");

		const parsed = Number(content);

		// Absent or unparseable means the document was not server-rendered — a
		// route opted out of SSR, or a test mounted the component directly. The
		// browser's own clock is the right answer there.
		readFromMeta = Number.isFinite(parsed) && parsed > 0 ? parsed : Date.now();
	}

	return readFromMeta;
}

/**
 * The instant the server rendered this document, in epoch milliseconds.
 *
 * Measuring a relative time needs an instant that the server render and the
 * hydration render that must match it both agree on, and neither the viewer's
 * clock (unknown to the server) nor the module's import time (the deploy, on a
 * long-lived process) is that. The server reads its own clock once per request;
 * the browser reads that same value back off the `<meta>` tag the root route
 * renders from it. Once hydrated, components stop consulting this and follow
 * the browser's clock instead.
 */
export const readServerNow: () => number = createIsomorphicFn()
	.server(getRequestNow)
	.client(readNowFromMeta);
