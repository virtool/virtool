import { followAuthError } from "@app/session";
import * as Sentry from "@sentry/tanstackstart-react";
import { refreshBrowserSessionFn } from "@server/auth/functions";
import { useEffect } from "react";

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
				if (!disposed && !followAuthError(error)) {
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
