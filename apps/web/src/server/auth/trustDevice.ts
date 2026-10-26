import type { BetterAuthPlugin } from "better-auth";
import { APIError, createAuthMiddleware } from "better-auth/api";

// Not exported by the two-factor plugin.
const TRUST_DEVICE_COOKIE_NAME = "trust_device";

function withoutCookie(header: string, name: string): string {
	return header
		.split(";")
		.filter((pair) => pair.split("=", 1)[0]?.trim() !== name)
		.join(";")
		.trim();
}

/**
 * Turn off the two-factor plugin's trusted devices.
 *
 * A trust cookie lets its browser skip the second factor at every sign-in
 * for as long as it is refreshed, which ends the second factor for that
 * browser. Better Auth has no option to turn the feature off, so this plugin
 * refuses a request that asks for a trust cookie and removes the cookie from
 * every request, so that one issued earlier is never read.
 *
 * Both rules are hooks, so they apply to HTTP requests and to `auth.api`
 * calls alike, and to any endpoint that accepts `trustDevice`.
 */
export function trustDeviceGuardPlugin() {
	return {
		id: "virtool-trust-device-guard",
		hooks: {
			before: [
				{
					matcher: () => true,
					handler: createAuthMiddleware(async (ctx) => {
						if (ctx.body?.trustDevice === true) {
							throw new APIError("BAD_REQUEST", {
								code: "TRUST_DEVICE_UNSUPPORTED",
								message: "Trusted devices are not supported",
							});
						}

						const cookie = ctx.headers?.get("cookie");
						if (!cookie) {
							return;
						}

						const { name } = ctx.context.createAuthCookie(
							TRUST_DEVICE_COOKIE_NAME,
						);
						const filtered = withoutCookie(cookie, name);
						if (filtered === cookie) {
							return;
						}

						return { context: { headers: new Headers({ cookie: filtered }) } };
					}),
				},
			],
		},
	} satisfies BetterAuthPlugin;
}
