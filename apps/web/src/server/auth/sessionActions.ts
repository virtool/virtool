import { createServerOnlyFn } from "@tanstack/react-start";

/** Sign in with a Virtool handle and copy Better Auth's cookie to the response. */
export const signInUsername = createServerOnlyFn(
	async (username: string, password: string, rememberMe = false) => {
		const [{ getRequest }, { auth }] = await Promise.all([
			import("@tanstack/react-start/server"),
			import("./instance"),
		]);

		return auth.api.signInUsername({
			headers: getRequest().headers,
			body: { username, password, rememberMe },
		});
	},
);

/** Sign out the current Better Auth session and clear its cookie. */
export const signOut = createServerOnlyFn(async () => {
	const [{ getRequest }, { auth }] = await Promise.all([
		import("@tanstack/react-start/server"),
		import("./instance"),
	]);

	return auth.api.signOut({ headers: getRequest().headers });
});

/**
 * Mint a replacement session with a fresh immutable absolute window.
 *
 * @public
 */
export const createReplacementSession = createServerOnlyFn(
	async (userId: number) => {
		const { auth } = await import("./instance");
		return auth.api.createRemediationSession({ body: { userId } });
	},
);

/** Verify the pending second factor and copy the resulting session cookies. */
export const verifyTwoFactor = createServerOnlyFn(
	async (code: string, recovery: boolean) => {
		const [{ getRequest }, { auth }] = await Promise.all([
			import("@tanstack/react-start/server"),
			import("./instance"),
		]);
		const options = {
			headers: getRequest().headers,
			body: { code, trustDevice: false },
		};
		return recovery
			? auth.api.verifyBackupCode(options)
			: auth.api.verifyTOTP(options);
	},
);
