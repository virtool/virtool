import { createServerOnlyFn } from "@tanstack/react-start";
import type { BrowserPrincipal } from "@virtool/contracts";
import { refreshBrowserSessionActivity } from "@virtool/data/auth/session";
import { db } from "../composition";
import { config } from "../config";

/** An explicit classification applied to qualifying browser activity. */
export type BrowserActivityKind = "user" | "foreground_heartbeat";

/** Persist qualifying activity for a normal Better Auth browser principal. */
export const refreshBrowserPrincipalActivity = createServerOnlyFn(
	async (
		principal: BrowserPrincipal,
		_kind: BrowserActivityKind,
	): Promise<BrowserPrincipal | null> => {
		if (principal.sessionStore !== "better_auth") {
			return principal;
		}

		const result = await refreshBrowserSessionActivity(
			db,
			principal.sessionId,
			principal.userId,
			config.browserSessionTiming,
		);
		if (result.status === "no_longer_valid") {
			return null;
		}

		return { ...principal, timing: result.timing };
	},
);
