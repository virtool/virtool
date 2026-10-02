import { accountQueryKeys } from "@account/keys";
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
import { WallContainer } from "./WallContainer";
import { WallTitle } from "./WallTitle";

type VerificationState =
	| { status: "loading" }
	| { status: "verified" }
	| { status: "unusable" }
	| {
			status: "interrupted";
			token: string;
			mode: "inspect" | "current" | "change";
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
			if (result.status === "verified") {
				queryClient.removeQueries({ queryKey: rootQueryKeys.all() });
				queryClient.removeQueries({ queryKey: accountQueryKeys.all() });
				setState({ status: "verified" });
				return;
			}
			setState({ status: "unusable" });
		} catch {
			setState({ status: "interrupted", token, mode });
		}
	}

	async function inspectAndVerify(token: string) {
		setState({ status: "loading" });
		try {
			const result = await inspectEmailVerificationFn({ data: { token } });
			if (result.status === "unusable") {
				setState({ status: "unusable" });
				return;
			}
			await verify(token, result.status);
		} catch {
			setState({ status: "interrupted", token, mode: "inspect" });
		}
	}

	useCapturedUrlParams(["token"], ({ token }) => {
		if (!token || !/^[0-9a-f]{64}$/.test(token)) {
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
			{state.status === "interrupted" && (
				<>
					<WallTitle
						title="Verification interrupted"
						subtitle="Sign in to the account changing its address, then reopen this link, or try again."
					/>
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
