/**
 * Write text to the system clipboard.
 *
 * The API is absent outside a secure context, and can be absent inside one — a
 * browser with the async clipboard turned off leaves `navigator.clipboard`
 * undefined. Reaching through it directly throws synchronously, where every
 * caller is written to handle a rejected promise, so the check lives here
 * rather than at each call site.
 */
export function writeToClipboard(text: string): Promise<void> {
	if (!navigator.clipboard?.writeText) {
		return Promise.reject(new Error("The clipboard is unavailable"));
	}

	return navigator.clipboard.writeText(text);
}
