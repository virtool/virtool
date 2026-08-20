const PRELOAD_RELOAD_KEY = "vt-preload-reloaded";

/**
 * Reload the page when a chunk the router asked for is no longer on the server.
 *
 * This is how a running tab picks up a redeploy: it reloads at the moment
 * staleness actually breaks a navigation, rather than interrupting the user on
 * every deploy.
 *
 * The guard records which build already reloaded rather than that one did. A
 * reload past a redeploy lands the tab on a new `__APP_VERSION__`, so the next
 * deploy re-arms it — a tab that survives two deploys recovers from both. A
 * build that still cannot preload after its own reload matches the stored
 * version, so a genuinely missing chunk surfaces the error instead of looping.
 */
export function handlePreloadError() {
	// sessionStorage can throw in Safari private mode or under storage-restriction
	// policies. If it does, skip the guard and reload anyway rather than swallow
	// the error and leave the user on a broken page.
	try {
		if (window.sessionStorage.getItem(PRELOAD_RELOAD_KEY) === __APP_VERSION__) {
			return;
		}
		window.sessionStorage.setItem(PRELOAD_RELOAD_KEY, __APP_VERSION__);
	} catch {
		// Ignore and fall through to the reload.
	}

	window.location.reload();
}
