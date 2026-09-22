import { accountQueryKeys } from "@account/keys";
import Button from "@base/Button";
import { InputGroup, InputLabel, InputSimple } from "@base/Input";
import {
	completePasswordRecoveryFn,
	inspectPasswordRecoveryFn,
	requestPasswordRecoveryFn,
} from "@server/auth/recoveryFunctions";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useLayoutEffect, useRef, useState } from "react";
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
	const [error, setError] = useState("");
	const [pending, setPending] = useState(false);
	const captured = useRef(false);
	const submitting = useRef(false);
	const queryClient = useQueryClient();

	useLayoutEffect(() => {
		if (captured.current) {
			return;
		}
		captured.current = true;
		const fragment = new URLSearchParams(window.location.hash.slice(1));
		const query = new URLSearchParams(window.location.search);
		const token = fragment.get("token") ?? query.get("token");
		const purpose = fragment.get("purpose") ?? query.get("purpose");
		window.history.replaceState(
			window.history.state,
			"",
			window.location.pathname,
		);
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
	}, []);

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
		submitting.current = true;
		setPending(true);
		setError("");
		try {
			const result = await completePasswordRecoveryFn({
				data: { token: state.token, purpose: state.purpose, password },
			});
			setPassword("");
			if (result.status === "unusable") {
				setState({ status: "unusable" });
				return;
			}
			queryClient.removeQueries({ queryKey: rootQueryKeys.all() });
			queryClient.removeQueries({ queryKey: accountQueryKeys.all() });
			setState({ status: "changed" });
		} catch {
			setPassword("");
			setError(
				"Your password could not be changed. Check the password policy and try again.",
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
						subtitle="Request a password reset link."
					/>
					<form onSubmit={requestRecovery}>
						<InputGroup>
							<InputLabel htmlFor="recovery-handle">Username</InputLabel>
							<InputSimple
								id="recovery-handle"
								autoComplete="username"
								required
								value={handle}
								onChange={(event) => setHandle(event.target.value)}
							/>
						</InputGroup>
						{error && <p role="alert">{error}</p>}
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
					<Link to="/login">Return to login</Link>
				</>
			)}
			{state.status === "ready" && (
				<>
					<WallTitle
						title="Choose a new password"
						subtitle="This recovery link can be used once."
					/>
					<form onSubmit={completeRecovery}>
						<InputGroup>
							<InputLabel htmlFor="new-password">New password</InputLabel>
							<InputSimple
								id="new-password"
								type="password"
								autoComplete="new-password"
								required
								value={password}
								onChange={(event) => setPassword(event.target.value)}
							/>
						</InputGroup>
						{error && <p role="alert">{error}</p>}
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
						subtitle="Sign in with your new password."
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
					{error && <p role="alert">{error}</p>}
					<Button
						color="blue"
						onClick={() => {
							setError("");
							setState({ status: "request" });
						}}
					>
						Request another link
					</Button>
				</>
			)}
		</WallContainer>
	);
}
