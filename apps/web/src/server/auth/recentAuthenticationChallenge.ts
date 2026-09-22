import type { BetterAuthPlugin } from "better-auth";
import {
	createAuthEndpoint,
	sensitiveSessionMiddleware,
} from "better-auth/api";
import { z } from "zod";

export const RECENT_AUTHENTICATION_PATH = "/virtool-session/challenge";

export const recentAuthenticationChallengeSchema = z.discriminatedUnion(
	"method",
	[
		z.object({ method: z.literal("password"), password: z.string().min(1) }),
		z.object({ method: z.literal("totp"), code: z.string().trim().min(1) }),
	],
);

/** A password or TOTP proof for the current browser session. */
type RecentAuthenticationChallenge = z.infer<
	typeof recentAuthenticationChallengeSchema
>;

/** Verify both challenge methods behind the same Better Auth rate-limit bucket. */
export function recentAuthenticationPlugin(
	verify: (
		headers: Headers,
		challenge: RecentAuthenticationChallenge,
	) => Promise<void>,
) {
	return {
		id: "virtool-recent-authentication",
		rateLimit: [
			{
				pathMatcher(path) {
					return path === RECENT_AUTHENTICATION_PATH;
				},
				window: 60,
				max: 5,
			},
		],
		endpoints: {
			verifyRecentAuthentication: createAuthEndpoint(
				RECENT_AUTHENTICATION_PATH,
				{
					method: "POST",
					body: recentAuthenticationChallengeSchema,
					use: [sensitiveSessionMiddleware],
					requireHeaders: true,
				},
				async (ctx) => {
					await verify(ctx.headers, ctx.body);
					return ctx.json({ status: true });
				},
			),
		},
	} satisfies BetterAuthPlugin;
}
