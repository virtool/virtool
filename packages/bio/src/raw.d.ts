/**
 * Vite's `?raw` suffix, which loads a file's contents as a string.
 *
 * Declared so a test can hold a fixture without this package gaining
 * `@types/node`. Nothing here touches the filesystem — a caller reads the
 * bytes and hands over text — and a test that called `readFileSync` would be
 * the first thing in the package to need a runtime.
 */
declare module "*?raw" {
	const content: string;

	export default content;
}
