import { accountQueryKeys } from "@account/keys";
import { isServiceUnavailable } from "@app/queryErrors";
import { lowercaseInputValue } from "@app/usernameInput";
import Button from "@base/Button";
import Field, { FieldLabel } from "@base/Field";
import Input from "@base/Input";
import { usePasswordRules } from "@forms/password";
import {
	completePasswordRecoveryFn,
	inspectPasswordRecoveryFn,
	requestPasswordRecoveryFn,
} from "@server/auth/recoveryFunctions";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { getWallErrorMessage } from "../errors";
import { useCapturedUrlParams } from "../hooks";
import { rootQueryKeys } from "../keys";
import { WallContainer } from "./WallContainer";
import { WallTitle } from "./WallTitle";

type RecoveryPurpose = "password_recovery" | "administrator_recovery";

type RecoveryState =
	| { status: "loading" }
	| { status: "request" }
	| { status: "acknowledged" }
	| { status: "ready"; token: string; purpose: RecoveryPurpose }
	| { status: "changed" }
	| { status: "unusable" }
	| { status: "unavailable"; token: string; purpose: RecoveryPurpose };

// Every request gets this text, so the screen does not show which accounts
// can receive recovery email.
const ADMINISTRATOR_HELP =
	"If you forgot your username, or your account has no verified email address, ask an administrator for a reset link.";

/** Minimal recovery entry and bearer-link completion screen. */
export default function RecoveryWall() {
	const [state, setState] = useState<RecoveryState>({ status: "loading" });
	const recoveryUsername = useLocation({
		select: (location) => location.state.recoveryUsername ?? "",
	});
	const [username, setUsername] = useState(recoveryUsername);
	const [emailVerificationCancelled, setEmailVerificationCancelled] =
		useState(false);
	const [password, setPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const passwordRules = usePasswordRules();
	const [error, setError] = useState("");
	const [pending, setPending] = useState(false);
	const submitting = useRef(false);
	const queryClient = useQueryClient();

	useCapturedUrlParams(["token", "purpose"], ({ token, purpose }) => {
		if (!token) {
			setState({ status: "request" });
			return;
		}
		if (
			!/^[0-9a-f]{64}$/.test(token) ||
			(purpose !== "password_recovery" && purpose !== "administrator_recovery")
		) {
			setState({ status: "unusable" });
			return;
		}
		inspectLink(token, purpose);
	});

	function inspectLink(token: string, purpose: RecoveryPurpose) {
		setState({ status: "loading" });
		void inspectPasswordRecoveryFn({ data: { token, purpose } })
			.then((result) => {
				setState(
					result.status === "usable"
						? { status: "ready", token, purpose }
						: { status: "unusable" },
				);
			})
			.catch((cause: unknown) => {
				if (isServiceUnavailable(cause)) {
					setState({ status: "unavailable", token, purpose });
					return;
				}
				setError(
					"The recovery service could not be reached. Try opening the link again.",
				);
				setState({ status: "unusable" });
			});
	}

	async function requestRecovery(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (submitting.current) {
			return;
		}
		submitting.current = true;
		setPending(true);
		setError("");
		try {
			await requestPasswordRecoveryFn({ data: { username } });
			setState({ status: "acknowledged" });
		} catch (cause) {
			setError(
				getWallErrorMessage(
					cause,
					"The request could not be completed. Try again.",
				),
			);
		} finally {
			submitting.current = false;
			setPending(false);
		}
	}

	async function completeRecovery(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (submitting.current || state.status !== "ready") {
			return;
		}
		if (password !== confirmPassword) {
			setError("The passwords do not match.");
			return;
		}
		if (
			passwordRules.minLength &&
			password.length < passwordRules.minLength.value
		) {
			setError(passwordRules.minLength.message);
			return;
		}
		submitting.current = true;
		setPending(true);
		setError("");
		try {
			const result = await completePasswordRecoveryFn({
				data: { token: state.token, purpose: state.purpose, password },
			});
			setPassword("");
			setConfirmPassword("");
			if (result.status === "unusable") {
				setState({ status: "unusable" });
				return;
			}
			queryClient.removeQueries({ queryKey: rootQueryKeys.all() });
			queryClient.removeQueries({ queryKey: accountQueryKeys.all() });
			setEmailVerificationCancelled(result.emailVerificationCancelled);
			setState({ status: "changed" });
		} catch (cause) {
			setPassword("");
			setConfirmPassword("");
			setError(
				getWallErrorMessage(
					cause,
					"Your password could not be changed. Try again.",
				),
			);
		} finally {
			submitting.current = false;
			setPending(false);
		}
	}

	return (
		<WallContainer>
			{state.status === "loading" && (
				<WallTitle title="Checking recovery link" subtitle="Please wait…" />
			)}
			{state.status === "request" && (
				<>
					<WallTitle
						title="Recover your account"
						subtitle="Enter your username. Virtool sends a link to choose a new password to the verified email address of the account."
					/>
					<form onSubmit={requestRecovery}>
						<Field>
							<FieldLabel>Username</FieldLabel>
							<Input
								autoComplete="username"
								required
								value={username}
								onChange={(event) => {
									lowercaseInputValue(event.target);
									setUsername(event.target.value);
								}}
							/>
						</Field>
						{error && (
							<p role="alert" className="mb-4 font-medium text-red-600">
								{error}
							</p>
						)}
						<Button color="blue" type="submit" disabled={pending}>
							Send recovery link
						</Button>
					</form>
					<p className="mt-6 text-gray-600">{ADMINISTRATOR_HELP}</p>
				</>
			)}
			{state.status === "acknowledged" && (
				<>
					<WallTitle
						title="Check your email"
						subtitle="If the account has a verified email address, Virtool sends a recovery link to it."
					/>
					<p className="mb-4 text-gray-600">
						If you asked for a link in the last hour, use that link. Virtool
						does not send a new one.
					</p>
					<p className="mb-6 text-gray-600">{ADMINISTRATOR_HELP}</p>
					<Link to="/login">Return to sign in</Link>
				</>
			)}
			{state.status === "ready" && (
				<>
					<WallTitle
						title="Choose a new password"
						subtitle="This recovery link can be used once."
					/>
					<form onSubmit={completeRecovery}>
						<Field>
							<FieldLabel>New password</FieldLabel>
							<Input
								type="password"
								autoComplete="new-password"
								required
								value={password}
								onChange={(event) => setPassword(event.target.value)}
							/>
						</Field>
						<Field>
							<FieldLabel>Confirm new password</FieldLabel>
							<Input
								type="password"
								autoComplete="new-password"
								required
								value={confirmPassword}
								onChange={(event) => setConfirmPassword(event.target.value)}
							/>
						</Field>
						{error && (
							<p role="alert" className="mb-4 font-medium text-red-600">
								{error}
							</p>
						)}
						<Button color="blue" type="submit" disabled={pending}>
							Change password
						</Button>
					</form>
				</>
			)}
			{state.status === "changed" && (
				<>
					<WallTitle
						title="Password changed"
						subtitle="Sign in with your new password. If your account needs more setup, Virtool asks for it after you sign in."
					/>
					{emailVerificationCancelled && (
						<p role="status" className="mb-6 text-gray-600">
							The password change cancelled a pending email verification. After
							you sign in, start the verification again in your account
							settings.
						</p>
					)}
					<Link to="/login">Sign in</Link>
				</>
			)}
			{state.status === "unavailable" && (
				<>
					<WallTitle
						title="Virtool is temporarily unavailable"
						subtitle="Your recovery link has not been used. Try again in a minute."
					/>
					<Button
						color="blue"
						onClick={() => inspectLink(state.token, state.purpose)}
					>
						Try again
					</Button>
				</>
			)}
			{state.status === "unusable" && (
				<>
					<WallTitle
						title="Recovery link unavailable"
						subtitle="This link cannot be used. Request another link or contact an administrator."
					/>
					{error && (
						<p role="alert" className="mb-4 font-medium text-red-600">
							{error}
						</p>
					)}
					<Button
						color="blue"
						onClick={() => {
							setError("");
							setState({ status: "request" });
						}}
					>
						Request another link
					</Button>
					<div className="mt-4">
						<Link to="/login">Return to sign in</Link>
					</div>
				</>
			)}
		</WallContainer>
	);
}
