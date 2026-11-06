import { followAuthError } from "@app/session";
import * as Sentry from "@sentry/tanstackstart-react";
import { refreshBrowserSessionFn } from "@server/auth/functions";
import { useEffect } from "react";

const NETWORK_FAILURE_MESSAGES = [
	"Failed to fetch",
	"Load failed",
	"NetworkError when attempting to fetch resource.",
];

/**
 * Recognise a request that the browser could not complete.
 *
 * `navigator.onLine` can be true while the network is unavailable, for example
 * just after sleep. Prefix matching is necessary because Sentry appends the host
 * to these messages. A server error never matches: it arrives as a plain `Error`.
 */
function isNetworkFailure(error: unknown): boolean {
	return (
		error instanceof TypeError &&
		NETWORK_FAILURE_MESSAGES.some((message) =>
			error.message.startsWith(message),
		)
	);
}

/** Revalidate an established session on shell mount and window focus. */
export function useBrowserSessionRefresh(enabled: boolean): void {
	useEffect(() => {
		if (!enabled) {
			return;
		}

		let disposed = false;
		let pending = false;

		async function refresh() {
			if (pending || !navigator.onLine) {
				return;
			}
			pending = true;
			try {
				await refreshBrowserSessionFn();
			} catch (error) {
				if (!disposed && !followAuthError(error) && !isNetworkFailure(error)) {
					Sentry.captureException(error);
				}
			} finally {
				pending = false;
			}
		}

		window.addEventListener("focus", refresh);
		void refresh();
		return function cleanup() {
			disposed = true;
			window.removeEventListener("focus", refresh);
		};
	}, [enabled]);
}
