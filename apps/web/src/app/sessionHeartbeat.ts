import { handleQueryError } from "@app/queryErrors";
import { heartbeatBrowserSessionFn } from "@server/auth/functions";
import { useEffect } from "react";

const HEARTBEAT_RETRY_INTERVAL_MILLISECONDS = 5_000;

/** Keep a signed-in browser session alive while its document is visible. */
export function useBrowserSessionHeartbeat(enabled: boolean): void {
	useEffect(() => {
		if (!enabled) {
			return;
		}

		let isStopped = false;
		let isPending = false;
		let timeout: number | undefined;

		async function heartbeat() {
			if (isStopped || isPending || document.visibilityState !== "visible") {
				return;
			}

			window.clearTimeout(timeout);
			isPending = true;
			let delay = HEARTBEAT_RETRY_INTERVAL_MILLISECONDS;

			try {
				const result = await heartbeatBrowserSessionFn();
				delay = result.nextHeartbeatInMilliseconds;
			} catch (error) {
				if (error instanceof Error) {
					handleQueryError(error);
				}
			} finally {
				isPending = false;
				if (!isStopped && document.visibilityState === "visible") {
					timeout = window.setTimeout(heartbeat, delay);
				}
			}
		}

		function handleVisibilityChange() {
			window.clearTimeout(timeout);
			if (document.visibilityState === "visible") {
				void heartbeat();
			}
		}

		document.addEventListener("visibilitychange", handleVisibilityChange);
		void heartbeat();

		return () => {
			isStopped = true;
			window.clearTimeout(timeout);
			document.removeEventListener("visibilitychange", handleVisibilityChange);
		};
	}, [enabled]);
}
