import Button from "@base/Button";
import Field, { FieldError, FieldLabel } from "@base/Field";
import Input from "@base/Input";
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
			// The mutation rotates the session cookies and invalidates the account
			// query, but navigation still belongs to the form.
			{
				onSuccess: (data) => {
					if (data.remediation) {
						navigate({
							to: "/email-remediation",
							search: { redirect },
						});
						return;
					}
					navigate({ to: redirect ?? "/" });
				},
			},
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
				<Field>
					<FieldLabel>Password</FieldLabel>
					<Input
						type="password"
						autoComplete="new-password"
						aria-required
						{...register("password", passwordRules)}
					/>
					<FieldError errors={[errors.password]}>
						{errors.password || !isError
							? undefined
							: error?.message || "An error occurred during password reset"}
					</FieldError>
				</Field>
				<Button type="submit" color="blue" disabled={isPending}>
					Reset
				</Button>
			</form>
		</>
	);
}
