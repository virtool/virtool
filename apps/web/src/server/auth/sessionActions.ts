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
