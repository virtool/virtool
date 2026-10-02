import { cn } from "@app/cn";
import {
	cancelPasskeyCeremony,
	getPasskeyNotice,
	signInWithPasskeyAutofill,
	usePasskeySupport,
} from "@app/passkeys";
import Button from "@base/Button";
import Field, { FieldLabel } from "@base/Field";
import Input from "@base/Input";
import { Link } from "@tanstack/react-router";
import { CircleAlert, Info, KeyRound } from "lucide-react";
import { useEffect, useEffectEvent, useState } from "react";
import { useForm } from "react-hook-form";
import { getWallErrorMessage } from "../errors";
import { useFollowAuthNextStep } from "../hooks";
import {
	type LoginResult,
	useLoginMutation,
	usePasskeySignInMutation,
} from "../queries";
import TwoFactorForm from "./TwoFactorForm";
import { WallTitle } from "./WallTitle";

type LoginFormProps = {
	/** URL to navigate to after a successful login. Defaults to "/". */
	redirect?: string;
	/** Shows the forced-reset form after the password has been authenticated. */
	setResetRequired: (required: boolean) => void;
};

type FormValues = {
	handle: string;
	password: string;
};

/** Handles the user login process. */
export default function LoginForm({
	redirect,
	setResetRequired,
}: LoginFormProps) {
	const { handleSubmit, register } = useForm<FormValues>();
	const loginMutation = useLoginMutation();
	const passkeyMutation = usePasskeySignInMutation();
	const passkeySupport = usePasskeySupport();
	const [twoFactor, setTwoFactor] = useState(false);
	const [continuing, setContinuing] = useState(false);
	const [continueError, setContinueError] = useState<string | null>(null);
	const follow = useFollowAuthNextStep();
	const isSigningIn =
		loginMutation.isPending || passkeyMutation.isPending || continuing;

	const onAutofillSignIn = useEffectEvent(() => void continueSignIn());

	useEffect(() => {
		let active = true;
		signInWithPasskeyAutofill()
			.then((signedIn) => {
				if (active && signedIn) {
					onAutofillSignIn();
				}
			})
			.catch(() => {
				if (active) {
					setContinueError(
						"Passkey sign-in failed. Try again or sign in with your password.",
					);
				}
			});
		return () => {
			active = false;
			cancelPasskeyCeremony();
		};
	}, []);

	async function continueSignIn() {
		setContinuing(true);
		setContinueError(null);
		try {
			const step = await follow(redirect);
			if (step.type === "password_reset") {
				setResetRequired(true);
			} else if (step.type === "login") {
				setContinueError("Sign-in did not finish. Try again.");
			}
		} catch {
			setContinueError("Virtool could not be reached. Try again.");
		} finally {
			setContinuing(false);
		}
	}

	function onSignedIn(data: LoginResult) {
		if ("twoFactorRedirect" in data) {
			setTwoFactor(true);
			return;
		}
		void continueSignIn();
	}

	function onSubmit({ handle, password }: FormValues) {
		if (isSigningIn) {
			return;
		}
		passkeyMutation.reset();
		setContinueError(null);
		loginMutation.mutate({ handle, password }, { onSuccess: onSignedIn });
	}

	function onPasskeySignIn() {
		if (isSigningIn) {
			return;
		}
		loginMutation.reset();
		setContinueError(null);
		passkeyMutation.mutate(undefined, {
			onSuccess: () => void continueSignIn(),
		});
	}

	const isError = loginMutation.isError || continueError !== null;
	const errorMessage = loginMutation.isError
		? getWallErrorMessage(loginMutation.error, "Sign-in failed. Try again.")
		: continueError;
	const passkeyNotice = passkeyMutation.isError
		? getPasskeyNotice(passkeyMutation.error)
		: null;
	const isPasskeyError = passkeyNotice?.tone === "error";
	const PasskeyNoticeIcon = isPasskeyError ? CircleAlert : Info;

	if (twoFactor) {
		return (
			<TwoFactorForm
				onVerified={() => void continueSignIn()}
				restart={() => {
					setTwoFactor(false);
					loginMutation.reset();
					passkeyMutation.reset();
				}}
			/>
		);
	}

	return (
		<>
			<WallTitle
				title="Sign in"
				subtitle="Sign in with your Virtool account."
			/>

			<form onSubmit={handleSubmit(onSubmit)}>
				<Field>
					<FieldLabel>Username</FieldLabel>
					<Input
						autoComplete="username webauthn"
						aria-required
						aria-invalid={isError || undefined}
						aria-describedby={isError ? "login-error" : undefined}
						{...register("handle", { required: true })}
						autoFocus
					/>
				</Field>
				<Field>
					<FieldLabel>Password</FieldLabel>
					<Input
						type="password"
						autoComplete="current-password"
						aria-required
						aria-invalid={isError || undefined}
						aria-describedby={isError ? "login-error" : undefined}
						{...register("password", { required: true })}
					/>
				</Field>
				<div className="flex justify-end my-4">
					{isError && (
						<div
							id="login-error"
							role="alert"
							className="flex items-center gap-1 text-red-600 font-medium"
						>
							<CircleAlert aria-hidden className="shrink-0" size={14} />
							{errorMessage}
						</div>
					)}
				</div>
				<div className="flex items-center justify-between">
					<Link to="/recover">Forgot your password?</Link>
					<Button type="submit" color="blue" disabled={isSigningIn}>
						Sign in
					</Button>
				</div>
			</form>

			<div className="flex flex-col gap-2 mt-6 pt-6 border-t border-gray-200">
				{passkeySupport === "unavailable" ? (
					<p className="text-gray-600 text-sm">
						Passkey sign-in is not available in this browser.
					</p>
				) : (
					<Button
						className="w-full"
						disabled={passkeySupport !== "available" || isSigningIn}
						onClick={onPasskeySignIn}
					>
						<KeyRound aria-hidden size={16} />
						{passkeyMutation.isPending
							? "Waiting for your passkey…"
							: "Sign in with a passkey"}
					</Button>
				)}
				{passkeyNotice && (
					<p
						role={isPasskeyError ? "alert" : "status"}
						className={cn(
							"flex items-center gap-1 font-medium",
							isPasskeyError ? "text-red-600" : "text-gray-600",
						)}
					>
						<PasskeyNoticeIcon aria-hidden className="shrink-0" size={14} />
						{passkeyNotice.message}
					</p>
				)}
			</div>
		</>
	);
}
