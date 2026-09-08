export function getDocumentTitle(title: string): string {
	if (
		import.meta.env.DEV &&
		typeof __DEV_INSTANCE__ !== "undefined" &&
		__DEV_INSTANCE__
	) {
		return `${title} · ${__DEV_INSTANCE__.branch} · ${__DEV_INSTANCE__.name}`;
	}
	return title;
}
