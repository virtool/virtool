import Button from "@base/Button";
import Field, { FieldError, FieldLabel } from "@base/Field";
import Input from "@base/Input";
import { useState } from "react";
import { useForm } from "react-hook-form";
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
					<FieldLabel>
						{recovery ? "Recovery code" : "Authentication code"}
					</FieldLabel>
					{recovery ? (
						<Input
							key="recovery"
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
						<Input
							key="authenticator"
							autoComplete="one-time-code"
							inputMode="numeric"
							maxLength={6}
							autoFocus
							aria-required
							{...register("authenticatorCode", {
								required: "Enter the code from your authenticator app",
								pattern: {
									value: /^\d{6}$/,
									message: "Enter the 6-digit code",
								},
							})}
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
				<div className="flex justify-end gap-2 my-4">
					<Button type="button" disabled={mutation.isPending} onClick={restart}>
						Back to sign in
					</Button>
					<Button type="submit" color="blue" disabled={mutation.isPending}>
						Verify
					</Button>
				</div>
				<Button
					type="button"
					disabled={mutation.isPending}
					onClick={toggleRecovery}
				>
					{recovery ? "Use authenticator code" : "Use recovery code"}
				</Button>
			</form>
		</>
	);
}
