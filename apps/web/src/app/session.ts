import { type AuthNextStep, getAuthNextStep } from "@wall/authStep";

const WALL_PATHS = {
	email_remediation: "/email-remediation",
	mfa_enrollment: "/mfa-enrollment",
};

let armed = false;
let ended = false;
let holds = 0;
let endDeferred = false;
let confirmation: Promise<boolean> | null = null;

/**
 * Allow `endSession` to act.
 *
 * Called once an authenticated load has succeeded. Until then `endSession` is
 * inert, because a 401 does not yet mean a session was lost: the login wall and
 * the authenticated route guard both fetch the account and *expect* a 401 when
 * nobody is logged in. Without this, a first-time visitor would be told their
 * session ended, and the wall could reload itself in a loop.
 */
export function armSessionEnd(): void {
	armed = true;
}

/**
 * Confirm that the browser's principal has changed, then leave the application
 * for the screen that the server calls for.
 *
 * A rejected request proves only that the credential it carried was refused. A
 * step-up rotation retires a cookie that the browser may already have replaced,
 * so the current cookie is asked before anything happens. The answer also names
 * the destination: an SSE 401 cannot tell a lost session from a restricted one.
 *
 * Idempotent, and a no-op until `armSessionEnd` has run. The full document load
 * is what clears everything held in memory — the React Query cache, zustand
 * stores, and the SSE connection — the same way `resetClient` ends a
 * user-initiated logout. The `reason` puts a "Your session ended" message on the
 * wall, and the `redirect` returns the user to where they were once they sign
 * back in.
 *
 * Everything that notices a session has gone converges here: `followAuthError`
 * and the SSE connection, on a 401 from the `/events` handshake.
 *
 * Resolves to whether the application is being left. A failed confirmation says
 * nothing about the session, so it resolves to `false` and the next rejection
 * asks again.
 */
export async function endSession(): Promise<boolean> {
	if (!armed || ended) {
		return ended;
	}

	if (holds > 0) {
		endDeferred = true;
		return false;
	}

	confirmation ??= confirmAuthStep().finally(() => {
		confirmation = null;
	});

	return confirmation;
}

/**
 * Act on an error that says the browser's principal has changed.
 *
 * Inert until `armSessionEnd` has run, for the same reason as `endSession`: the
 * walls fetch the account and expect these errors.
 *
 * Returns whether the error was about the principal.
 */
export function followAuthError(error: unknown): boolean {
	if (getAuthNextStep(error) === null) {
		return false;
	}

	void endSession();

	return true;
}

/**
 * Run a request that rotates the session, and keep the page in place until it
 * settles.
 *
 * The server retires the old session before the browser has the new cookie, so
 * until the response arrives the browser holds only a dead credential.
 * Navigating then would cancel the rotation and lose the new cookie. Asking the
 * server would get the same refusal, so the question waits for the rotation.
 */
export async function holdSessionEnd<T>(rotate: () => Promise<T>): Promise<T> {
	holds += 1;

	try {
		return await rotate();
	} finally {
		holds -= 1;

		if (holds === 0 && endDeferred) {
			endDeferred = false;
			void endSession();
		}
	}
}

async function confirmAuthStep(): Promise<boolean> {
	let step: AuthNextStep | null;

	try {
		const { getAccountFn } = await import("@server/users/functions");
		await getAccountFn();
		return false;
	} catch (error) {
		step = getAuthNextStep(error);
	}

	if (step === null) {
		return false;
	}

	// A rotation that started during the request makes this answer stale.
	if (holds > 0) {
		endDeferred = true;
		return false;
	}

	return leaveFor(step);
}

function leaveFor(step: AuthNextStep): boolean {
	const { pathname, search } = window.location;
	const returnPath = `${pathname}${search}`;

	if (step.type === "mfa_enrollment" || step.type === "email_remediation") {
		const path = WALL_PATHS[step.type];

		if (pathname === path) {
			return false;
		}

		ended = true;

		// The session outlives MFA enrollment, so a draft is still its owner's.
		if (step.type === "email_remediation") {
			window.sessionStorage.clear();
		}

		const params = new URLSearchParams({ redirect: returnPath });
		window.location.assign(`${path}?${params.toString()}`);
		return true;
	}

	ended = true;

	const params = new URLSearchParams({ reason: "session-ended" });

	if (!pathname.startsWith("/login")) {
		params.set("redirect", returnPath);
	}

	window.sessionStorage.clear();
	window.location.assign(`/login?${params.toString()}`);
	return true;
}
