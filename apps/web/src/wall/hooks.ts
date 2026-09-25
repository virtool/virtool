import { useLayoutEffect, useRef } from "react";

/**
 * Read bearer parameters from the URL fragment or query, strip them from
 * history, and pass them to `onCapture` once.
 *
 * The parameters are removed before any request can send the URL as a
 * referrer. The guard keeps a repeated effect, such as the StrictMode
 * remount, from reading the already stripped URL.
 */
export function useCapturedUrlParams<K extends string>(
	names: readonly K[],
	onCapture: (params: Record<K, string | null>) => void,
) {
	const captured = useRef(false);

	useLayoutEffect(() => {
		if (captured.current) {
			return;
		}
		captured.current = true;

		const fragment = new URLSearchParams(window.location.hash.slice(1));
		const query = new URLSearchParams(window.location.search);
		const params = Object.fromEntries(
			names.map((name) => [name, fragment.get(name) ?? query.get(name)]),
		) as Record<K, string | null>;

		window.history.replaceState(
			window.history.state,
			"",
			window.location.pathname,
		);

		onCapture(params);
	}, []);
}
