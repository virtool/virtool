import { accountQueryKeys } from "@account/keys";
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
import { Link } from "@tanstack/react-router";
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
	| { status: "unusable" };

/** Minimal recovery entry and bearer-link completion screen. */
export default function RecoveryWall() {
	const [state, setState] = useState<RecoveryState>({ status: "loading" });
	const [handle, setHandle] = useState("");
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
		void inspectPasswordRecoveryFn({ data: { token, purpose } })
			.then((result) => {
				setState(
					result.status === "usable"
						? { status: "ready", token, purpose }
						: { status: "unusable" },
				);
			})
			.catch(() => {
				setError(
					"The recovery service could not be reached. Try opening the link again.",
				);
				setState({ status: "unusable" });
			});
	});

	async function requestRecovery(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (submitting.current) {
			return;
		}
		submitting.current = true;
		setPending(true);
		setError("");
		try {
			await requestPasswordRecoveryFn({ data: { handle } });
			setState({ status: "acknowledged" });
		} catch {
			setError("The request could not be completed. Try again.");
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
						subtitle="Enter your username. If the account can receive email, Virtool sends it a link to choose a new password."
					/>
					<form onSubmit={requestRecovery}>
						<Field>
							<FieldLabel>Username</FieldLabel>
							<Input
								autoComplete="username"
								required
								value={handle}
								onChange={(event) => setHandle(event.target.value)}
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
				</>
			)}
			{state.status === "acknowledged" && (
				<>
					<WallTitle
						title="Check your email"
						subtitle="If this account can receive recovery email, a link has been queued."
					/>
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
					<Link to="/login">Sign in</Link>
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
