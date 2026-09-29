import { cn } from "@app/cn";
import { getPasskeyNotice, usePasskeySupport } from "@app/passkeys";
import Button from "@base/Button";
import { InputGroup, InputLabel, InputSimple } from "@base/Input";
import { Link, useNavigate } from "@tanstack/react-router";
import { CircleAlert, Info, KeyRound } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
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
	const navigate = useNavigate();

	function onSignedIn(data: LoginResult) {
		if ("twoFactorRedirect" in data) {
			setTwoFactor(true);
			return;
		}
		if (data.reset) {
			setResetRequired(true);
			return;
		}
		if ("remediation" in data && data.remediation) {
			navigate({
				to: "/email-remediation",
				search: { redirect },
			});
			return;
		}
		navigate({ to: redirect ?? "/" });
	}

	function onSubmit({ handle, password }: FormValues) {
		passkeyMutation.reset();
		loginMutation.mutate({ handle, password }, { onSuccess: onSignedIn });
	}

	function onPasskeySignIn() {
		loginMutation.reset();
		passkeyMutation.mutate(undefined, { onSuccess: onSignedIn });
	}

	const { error, isError } = loginMutation;
	const passkeyNotice = passkeyMutation.isError
		? getPasskeyNotice(passkeyMutation.error)
		: null;
	const isPasskeyError = passkeyNotice?.tone === "error";
	const PasskeyNoticeIcon = isPasskeyError ? CircleAlert : Info;

	if (twoFactor) {
		return (
			<TwoFactorForm
				redirect={redirect}
				setResetRequired={setResetRequired}
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
			<WallTitle title="Login" subtitle="Login with your Virtool account." />

			<form onSubmit={handleSubmit(onSubmit)}>
				<InputGroup>
					<InputLabel htmlFor="handle">Username</InputLabel>
					<InputSimple
						id="handle"
						autoComplete="username"
						aria-required
						aria-invalid={isError || undefined}
						aria-describedby={isError ? "login-error" : undefined}
						{...register("handle", { required: true })}
						autoFocus
					/>
				</InputGroup>
				<InputGroup>
					<InputLabel htmlFor="password">Password</InputLabel>
					<InputSimple
						id="password"
						type="password"
						autoComplete="current-password"
						aria-required
						aria-invalid={isError || undefined}
						aria-describedby={isError ? "login-error" : undefined}
						{...register("password", { required: true })}
					/>
				</InputGroup>
				<div className="flex justify-end my-4">
					{isError && (
						<div
							id="login-error"
							role="alert"
							className="flex items-center gap-1 text-red-600 font-medium"
						>
							<CircleAlert aria-hidden className="shrink-0" size={14} />
							{error?.message || "An error occurred during login"}
						</div>
					)}
				</div>
				<div className="flex items-center justify-between">
					<Link to="/recover">Forgot your password?</Link>
					<Button type="submit" color="blue">
						Login
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
						disabled={
							passkeySupport !== "available" || passkeyMutation.isPending
						}
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
