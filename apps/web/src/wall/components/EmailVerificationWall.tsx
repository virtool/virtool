import { accountQueryKeys } from "@account/keys";
import { isServiceUnavailable } from "@app/queryErrors";
import Button from "@base/Button";
import {
	completeAccountEmailChangeFn,
	inspectEmailVerificationFn,
	verifyCurrentEmailFn,
} from "@server/auth/recoveryFunctions";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { useCapturedUrlParams } from "../hooks";
import { rootQueryKeys } from "../keys";
import { getAuthNextStep } from "../nextStep";
import { WallContainer } from "./WallContainer";
import { WallTitle } from "./WallTitle";

const PENDING_EMAIL_CHANGE_KEY = "vt-pending-email-change";

function storePendingEmailChange(token: string): boolean {
	try {
		window.sessionStorage.setItem(PENDING_EMAIL_CHANGE_KEY, token);
		return true;
	} catch {
		return false;
	}
}

function getPendingEmailChange(): string | null {
	try {
		return window.sessionStorage.getItem(PENDING_EMAIL_CHANGE_KEY);
	} catch {
		return null;
	}
}

function clearPendingEmailChange() {
	try {
		window.sessionStorage.removeItem(PENDING_EMAIL_CHANGE_KEY);
	} catch {}
}

type VerificationState =
	| { status: "loading" }
	| { status: "verified" }
	| { status: "unusable" }
	| { status: "sign_in_required" }
	| {
			status: "interrupted";
			token: string;
			mode: "inspect" | "current" | "change";
			unavailable: boolean;
	  };

/** Minimal token-safe mailbox verification screen. */
export default function EmailVerificationWall() {
	const [state, setState] = useState<VerificationState>({ status: "loading" });
	const queryClient = useQueryClient();

	async function verify(token: string, mode: "current" | "change") {
		setState({ status: "loading" });
		try {
			const result =
				mode === "current"
					? await verifyCurrentEmailFn({ data: { token } })
					: await completeAccountEmailChangeFn({ data: { token } });
			clearPendingEmailChange();
			if (result.status === "verified") {
				queryClient.removeQueries({ queryKey: rootQueryKeys.all() });
				queryClient.removeQueries({ queryKey: accountQueryKeys.all() });
				setState({ status: "verified" });
				return;
			}
			setState({ status: "unusable" });
		} catch (cause) {
			// A change completes only for the account that requested it, so the
			// link waits in this tab while the user signs in.
			if (
				mode === "change" &&
				getAuthNextStep(cause) !== null &&
				storePendingEmailChange(token)
			) {
				setState({ status: "sign_in_required" });
				return;
			}
			setState({
				status: "interrupted",
				token,
				mode,
				unavailable: isServiceUnavailable(cause),
			});
		}
	}

	async function inspectAndVerify(token: string) {
		setState({ status: "loading" });
		try {
			const result = await inspectEmailVerificationFn({ data: { token } });
			if (result.status === "unusable") {
				clearPendingEmailChange();
				setState({ status: "unusable" });
				return;
			}
			await verify(token, result.status);
		} catch (cause) {
			setState({
				status: "interrupted",
				token,
				mode: "inspect",
				unavailable: isServiceUnavailable(cause),
			});
		}
	}

	useCapturedUrlParams(["token"], (params) => {
		// A newly opened link replaces any change still waiting for sign-in.
		if (params.token) {
			clearPendingEmailChange();
		}
		const token = params.token ?? getPendingEmailChange();
		if (!token || !/^[0-9a-f]{64}$/.test(token)) {
			clearPendingEmailChange();
			setState({ status: "unusable" });
			return;
		}
		void inspectAndVerify(token);
	});

	return (
		<WallContainer>
			{state.status === "loading" && (
				<WallTitle title="Verifying email" subtitle="Checking your link…" />
			)}
			{state.status === "verified" && (
				<>
					<WallTitle
						title="Email verified"
						subtitle="Your email address has been confirmed."
					/>
					<Link to="/login">Continue to login</Link>
				</>
			)}
			{state.status === "unusable" && (
				<>
					<WallTitle
						title="Verification link unavailable"
						subtitle="This link cannot be used. Request another link from your account settings or contact an administrator."
					/>
					<Link to="/login">Return to login</Link>
				</>
			)}
			{state.status === "sign_in_required" && (
				<>
					<WallTitle
						title="Sign in to change your email"
						subtitle="Sign in to the account that requested this change. The change completes after you sign in."
					/>
					<Link to="/login" search={{ redirect: "/verify-email" }}>
						Sign in
					</Link>
				</>
			)}
			{state.status === "interrupted" && (
				<>
					{state.unavailable ? (
						<WallTitle
							title="Virtool is temporarily unavailable"
							subtitle="Your verification link has not been used. Try again in a minute."
						/>
					) : (
						<WallTitle
							title="Verification interrupted"
							subtitle="Sign in to the account changing its address, then reopen this link, or try again."
						/>
					)}
					<Button
						color="blue"
						onClick={() =>
							void (state.mode === "inspect"
								? inspectAndVerify(state.token)
								: verify(state.token, state.mode))
						}
					>
						Try again
					</Button>
					<Link to="/login">Sign in</Link>
				</>
			)}
		</WallContainer>
	);
}
