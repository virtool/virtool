import Button, { LinkButton } from "@base/Button";
import Field, { FieldError } from "@base/Field";
import Input, { InputOTP } from "@base/Input";
import { REGEXP_ONLY_DIGITS } from "input-otp";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { getWallErrorMessage } from "../errors";
import { useVerifyTwoFactorMutation } from "../queries";
import { WallTitle } from "./WallTitle";

type TwoFactorFormProps = {
	/** Continues sign-in after the server accepts the code. */
	onVerified: () => void;
	/** Returns to the sign-in form. */
	restart: () => void;
};

type FormValues = {
	authenticatorCode?: string;
	recoveryCode?: string;
};

/** The second step of sign-in for a user with TOTP turned on. */
export default function TwoFactorForm({
	onVerified,
	restart,
}: TwoFactorFormProps) {
	const [recovery, setRecovery] = useState(false);
	const {
		control,
		formState: { errors },
		register,
		handleSubmit,
	} = useForm<FormValues>({
		shouldUnregister: true,
	});
	const mutation = useVerifyTwoFactorMutation();

	function onSubmit({ authenticatorCode, recoveryCode }: FormValues) {
		if (mutation.isPending) {
			return;
		}
		mutation.mutate(
			{
				code: recovery ? (recoveryCode ?? "") : (authenticatorCode ?? ""),
				recovery,
			},
			{ onSuccess: onVerified },
		);
	}

	function toggleRecovery() {
		setRecovery(!recovery);
		mutation.reset();
	}

	const fieldError = recovery ? errors.recoveryCode : errors.authenticatorCode;

	return (
		<>
			<WallTitle
				title="Two-factor authentication"
				subtitle={
					recovery
						? "Enter one of your recovery codes."
						: "Enter the code from your authenticator app."
				}
			/>
			<form onSubmit={handleSubmit(onSubmit)}>
				<Field>
					{recovery ? (
						<Input
							key="recovery"
							aria-label="Recovery code"
							autoComplete="off"
							autoCapitalize="none"
							spellCheck={false}
							autoFocus
							aria-required
							{...register("recoveryCode", {
								required: "Enter a recovery code",
							})}
						/>
					) : (
						<Controller
							name="authenticatorCode"
							control={control}
							defaultValue=""
							rules={{
								required: "Enter the code from your authenticator app",
								pattern: {
									value: /^\d{6}$/,
									message: "Enter the 6-digit code",
								},
							}}
							render={({ field }) => (
								<InputOTP
									aria-label="Authentication code"
									autoComplete="one-time-code"
									autoFocus
									aria-required
									inputMode="numeric"
									length={6}
									pattern={REGEXP_ONLY_DIGITS}
									{...field}
								/>
							)}
						/>
					)}
					<FieldError
						errors={[
							fieldError,
							mutation.isError
								? {
										message: getWallErrorMessage(
											mutation.error,
											"The code could not be checked. Try again.",
										),
									}
								: undefined,
						]}
					/>
				</Field>
				<div className="my-4 flex items-center justify-between">
					<div className="flex flex-wrap items-center gap-x-4 gap-y-1">
						<LinkButton disabled={mutation.isPending} onClick={toggleRecovery}>
							{recovery ? "Use authenticator code" : "Use recovery code"}
						</LinkButton>
						<LinkButton disabled={mutation.isPending} onClick={restart}>
							Back to sign in
						</LinkButton>
					</div>
					<Button type="submit" color="blue" disabled={mutation.isPending}>
						Verify
					</Button>
				</div>
			</form>
		</>
	);
}
