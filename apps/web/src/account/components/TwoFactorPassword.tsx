import { DialogFooter } from "@base/Dialog";
import Field, { FieldError, FieldLabel } from "@base/Field";
import { InputPassword } from "@base/Input";
import SaveButton from "@base/SaveButton";
import { useForm } from "react-hook-form";
import { getTwoFactorErrorMessage } from "../twoFactor";

type FormValues = {
	password: string;
};

type TwoFactorPasswordProps = {
	/** The failure from the last submission, if any */
	error: Error | null;
	/** Whether a submission is in flight */
	isPending: boolean;
	onSubmit: (password: string) => void;
	/** The submit button text */
	submitLabel: string;
};

/** A password check that starts a two-factor change. */
export default function TwoFactorPassword({
	error,
	isPending,
	onSubmit,
	submitLabel,
}: TwoFactorPasswordProps) {
	const {
		formState: { errors },
		handleSubmit,
		register,
	} = useForm<FormValues>({ defaultValues: { password: "" } });

	return (
		<form onSubmit={handleSubmit(({ password }) => onSubmit(password))}>
			<Field>
				<FieldLabel>Password</FieldLabel>
				<InputPassword
					autoComplete="current-password"
					aria-required
					{...register("password", {
						required: "Enter your password",
					})}
				/>
				<FieldError
					errors={[
						errors.password,
						error ? { message: getTwoFactorErrorMessage(error) } : undefined,
					]}
				/>
			</Field>
			<DialogFooter>
				<SaveButton altText={submitLabel} disabled={isPending} />
			</DialogFooter>
		</form>
	);
}
