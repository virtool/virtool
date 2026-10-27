/**
 * Save text as a file through the browser's download flow.
 *
 * The object URL is revoked once the click has started the download, so the
 * blob does not stay in memory for the life of the page.
 */
export function downloadText(text: string, filename: string, type: string) {
	const url = URL.createObjectURL(new Blob([text], { type }));
	const link = document.createElement("a");
	link.href = url;
	link.download = filename;
	link.click();
	URL.revokeObjectURL(url);
}
