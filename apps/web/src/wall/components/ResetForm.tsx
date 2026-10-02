import Button from "@base/Button";
import Field, { FieldError, FieldLabel } from "@base/Field";
import Input from "@base/Input";
import { usePasswordRules } from "@forms/password";
import { useForm } from "react-hook-form";
import { getWallErrorMessage } from "../errors";
import { useFollowAuthNextStep } from "../hooks";
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
	const follow = useFollowAuthNextStep();
	const passwordRules = usePasswordRules();

	function onSubmit({ password }: { password: string }) {
		if (resetPasswordMutation.isPending) {
			return;
		}
		// The mutation rotates the session cookies. The server then says which
		// step comes next.
		resetPasswordMutation.mutate(
			{ password },
			{ onSuccess: () => void follow(redirect) },
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
							: getWallErrorMessage(
									error,
									"Your password could not be changed. Try again.",
								)}
					</FieldError>
				</Field>
				<Button type="submit" color="blue" disabled={isPending}>
					Reset
				</Button>
			</form>
		</>
	);
}
