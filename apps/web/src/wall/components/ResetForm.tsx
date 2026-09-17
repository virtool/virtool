import Button from "@base/Button";
import { InputError, InputGroup, InputLabel, InputSimple } from "@base/Input";
import { usePasswordRules } from "@forms/password";
import { useNavigate } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { useResetPasswordMutation } from "../queries";
import { WallTitle } from "./WallTitle";

type ResetFormProps = {
	/** URL to navigate to after a successful reset. Defaults to "/". */
	redirect?: string;
};

/** Handles the password reset process. */
export default function ResetForm({ redirect }: ResetFormProps) {
	const {
		formState: { errors },
		register,
		handleSubmit,
	} = useForm({
		defaultValues: { password: "" },
	});
	const resetPasswordMutation = useResetPasswordMutation();
	const navigate = useNavigate();
	const passwordRules = usePasswordRules();

	function onSubmit({ password }: { password: string }) {
		resetPasswordMutation.mutate(
			{ password },
			// The reset already authenticated us: it rotated the session cookies
			// and invalidated the account query. Without this the user sits on the
			// form with no feedback.
			{ onSuccess: () => navigate({ to: redirect ?? "/" }) },
		);
	}

	const { error, isError, isPending } = resetPasswordMutation;

	return (
		<>
			<WallTitle
				title="Password Reset"
				subtitle="You must set a new password before proceeding."
			/>
			<form onSubmit={handleSubmit(onSubmit)}>
				<InputGroup>
					<InputLabel htmlFor="password">Password</InputLabel>
					<InputSimple
						id="password"
						type="password"
						autoComplete="new-password"
						aria-required
						aria-invalid={Boolean(errors.password) || undefined}
						aria-describedby={errors.password ? "password-error" : undefined}
						{...register("password", passwordRules)}
					/>
					{errors.password?.message && (
						<InputError id="password-error">
							{errors.password.message}
						</InputError>
					)}
					{isError && (
						<InputError>
							{error?.message || "An error occurred during password reset"}
						</InputError>
					)}
				</InputGroup>
				{/* The reset rotates this session. Avoid submitting twice against a
				    credential that the first request has already invalidated. */}
				<Button type="submit" color="blue" disabled={isPending}>
					Reset
				</Button>
			</form>
		</>
	);
}
