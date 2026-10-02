import {
	type AuthenticatorTransportFuture,
	generateAuthenticationOptions,
	verifyAuthenticationResponse,
} from "@simplewebauthn/server";
import { isoBase64URL } from "@simplewebauthn/server/helpers";
import { RECENT_AUTHENTICATION_PASSKEY_OPTIONS_PATH } from "@virtool/contracts";
import {
	getPasskeyCredentialIds,
	getUserPasskey,
	setPasskeyCounter,
} from "@virtool/data/auth/passkeys";
import type { Db } from "@virtool/data/db/pg";
import type { BetterAuthPlugin } from "better-auth";
import {
	APIError,
	createAuthEndpoint,
	sensitiveSessionMiddleware,
} from "better-auth/api";
import { generateRandomString } from "better-auth/crypto";
import { z } from "zod";

export const RECENT_AUTHENTICATION_PATH = "/virtool-session/challenge";

const PASSKEY_CHALLENGE_COOKIE = "step_up_passkey";

const PASSKEY_CHALLENGE_MAX_AGE_SECONDS = 300;

const PASSKEY_CHALLENGE_TYPE = "step-up";

const TRANSPORTS = new Set<string>([
	"ble",
	"cable",
	"hybrid",
	"internal",
	"nfc",
	"smart-card",
	"usb",
] satisfies AuthenticatorTransportFuture[]);

const base64Url = z.string().min(1).max(4096);

// The fields of `AuthenticationResponseJSON` that verification reads. Unknown
// extension results are dropped, because the options ask for no extensions.
const passkeyAssertionSchema = z.object({
	id: base64Url,
	rawId: base64Url,
	type: z.literal("public-key"),
	response: z.object({
		clientDataJSON: base64Url,
		authenticatorData: base64Url,
		signature: base64Url,
		userHandle: base64Url.optional(),
	}),
	authenticatorAttachment: z.enum(["platform", "cross-platform"]).optional(),
	clientExtensionResults: z.object({}),
});

export const recentAuthenticationChallengeSchema = z.discriminatedUnion(
	"method",
	[
		z.object({ method: z.literal("password"), password: z.string().min(1) }),
		z.object({ method: z.literal("totp"), code: z.string().trim().min(1) }),
		z.object({
			method: z.literal("passkey"),
			response: passkeyAssertionSchema,
		}),
	],
);

/** A password, TOTP, or passkey proof for the current browser session. */
type RecentAuthenticationChallenge = z.infer<
	typeof recentAuthenticationChallengeSchema
>;

/** A password or TOTP proof that Better Auth verifies. */
type NativeChallenge = Exclude<
	RecentAuthenticationChallenge,
	{ method: "passkey" }
>;

/** What {@link recentAuthenticationPlugin} needs to verify each method. */
type RecentAuthenticationOptions = {
	db: Db;
	/** The one origin a passkey assertion must come from. */
	origin: string;
	rpID: string;
	verify: (headers: Headers, challenge: NativeChallenge) => Promise<void>;
};

const storedPasskeyChallengeSchema = z.object({
	type: z.literal(PASSKEY_CHALLENGE_TYPE),
	expectedChallenge: z.string(),
	userId: z.number().int(),
});

function rejectPasskey(): never {
	throw new APIError("BAD_REQUEST", {
		code: "PASSKEY_CHALLENGE_FAILED",
		message: "Passkey verification failed",
	});
}

function getSessionUserId(user: { id: string | number }): number {
	const userId = Number(user.id);
	if (!Number.isSafeInteger(userId)) {
		throw new APIError("UNAUTHORIZED");
	}
	return userId;
}

function toTransports(value: string | null): AuthenticatorTransportFuture[] {
	return (value?.split(",") ?? []).filter(
		(transport): transport is AuthenticatorTransportFuture =>
			TRANSPORTS.has(transport),
	);
}

/**
 * Verify every recent-authentication method behind the same Better Auth
 * rate-limit rule.
 *
 * Passkeys use their own ceremony and not Better Auth's
 * `/passkey/verify-authentication`. That endpoint signs in whoever holds the
 * passkey and does not check that it belongs to the user of this session.
 */
export function recentAuthenticationPlugin({
	db,
	origin,
	rpID,
	verify,
}: RecentAuthenticationOptions) {
	return {
		id: "virtool-recent-authentication",
		rateLimit: [
			{
				pathMatcher(path) {
					return (
						path === RECENT_AUTHENTICATION_PATH ||
						path === RECENT_AUTHENTICATION_PASSKEY_OPTIONS_PATH
					);
				},
				window: 60,
				max: 5,
			},
		],
		endpoints: {
			getRecentAuthenticationPasskeyOptions: createAuthEndpoint(
				RECENT_AUTHENTICATION_PASSKEY_OPTIONS_PATH,
				{
					method: "GET",
					use: [sensitiveSessionMiddleware],
					requireHeaders: true,
				},
				async (ctx) => {
					const userId = getSessionUserId(ctx.context.session.user);
					const credentials = await getPasskeyCredentialIds(db, userId);
					if (credentials.length === 0) {
						rejectPasskey();
					}

					const options = await generateAuthenticationOptions({
						rpID,
						userVerification: "required",
						allowCredentials: credentials.map((credential) => ({
							id: credential.credentialID,
							transports: toTransports(credential.transports),
						})),
					});

					const token = generateRandomString(32);
					const cookie = ctx.context.createAuthCookie(PASSKEY_CHALLENGE_COOKIE);
					await ctx.setSignedCookie(cookie.name, token, ctx.context.secret, {
						...cookie.attributes,
						maxAge: PASSKEY_CHALLENGE_MAX_AGE_SECONDS,
					});
					await ctx.context.internalAdapter.createVerificationValue({
						identifier: token,
						value: JSON.stringify({
							type: PASSKEY_CHALLENGE_TYPE,
							expectedChallenge: options.challenge,
							userId,
						}),
						expiresAt: new Date(
							Date.now() + PASSKEY_CHALLENGE_MAX_AGE_SECONDS * 1000,
						),
					});

					return ctx.json(options);
				},
			),
			verifyRecentAuthentication: createAuthEndpoint(
				RECENT_AUTHENTICATION_PATH,
				{
					method: "POST",
					body: recentAuthenticationChallengeSchema,
					use: [sensitiveSessionMiddleware],
					requireHeaders: true,
				},
				async (ctx) => {
					if (ctx.body.method !== "passkey") {
						await verify(ctx.headers, ctx.body);
						return ctx.json({ status: true });
					}

					const userId = getSessionUserId(ctx.context.session.user);
					const cookie = ctx.context.createAuthCookie(PASSKEY_CHALLENGE_COOKIE);
					const token = await ctx.getSignedCookie(
						cookie.name,
						ctx.context.secret,
					);
					if (!token) {
						rejectPasskey();
					}
					ctx.setCookie(cookie.name, "", { ...cookie.attributes, maxAge: 0 });

					const stored =
						await ctx.context.internalAdapter.consumeVerificationValue(token);
					const challenge = storedPasskeyChallengeSchema.safeParse(
						stored ? JSON.parse(stored.value) : null,
					);
					if (!challenge.success || challenge.data.userId !== userId) {
						rejectPasskey();
					}

					const response = ctx.body.response;
					const passkey = await getUserPasskey(db, userId, response.id);
					if (!passkey) {
						rejectPasskey();
					}

					const verification = await verifyAuthenticationResponse({
						response,
						expectedChallenge: challenge.data.expectedChallenge,
						expectedOrigin: origin,
						expectedRPID: rpID,
						credential: {
							id: passkey.credentialID,
							publicKey: isoBase64URL.toBuffer(passkey.publicKey, "base64"),
							counter: passkey.counter,
							transports: toTransports(passkey.transports),
						},
						requireUserVerification: true,
					}).catch(() => rejectPasskey());

					if (
						!verification.verified ||
						!verification.authenticationInfo.userVerified
					) {
						rejectPasskey();
					}

					await setPasskeyCounter(
						db,
						passkey.id,
						verification.authenticationInfo.newCounter,
					);
					return ctx.json({ status: true });
				},
			),
		},
	} satisfies BetterAuthPlugin;
}
