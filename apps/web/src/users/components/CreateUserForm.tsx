import Checkbox from "@base/Checkbox";
import { InputError, InputGroup, InputLabel, InputSimple } from "@base/Input";
import SaveButton from "@base/SaveButton";
import { usePasswordRules } from "@forms/password";
import { Controller, useForm } from "react-hook-form";

type CreateUserFormProps = {
	/** The user's handle or username */
	handle?: string;
	/** The user's password */
	password?: string;
	/** Error message to be displayed */
	error: string;
	/** A callback function to be called when the form is submitted */
	onSubmit: (data: {
		handle: string;
		password: string;
		forceReset: boolean;
	}) => void;
};

/**
 * A form component for creating a new user
 */
export function CreateUserForm({
	handle = "",
	password = "",
	error,
	onSubmit,
}: CreateUserFormProps) {
	const passwordRules = usePasswordRules();
	const {
		formState: { errors },
		register,
		handleSubmit,
		control,
	} = useForm({ defaultValues: { handle, password, forceReset: false } });

	return (
		<form onSubmit={handleSubmit((values) => onSubmit({ ...values }))}>
			<InputGroup>
				<InputLabel htmlFor="handle">Username</InputLabel>
				<InputSimple
					id="handle"
					autoComplete="off"
					aria-required
					aria-invalid={Boolean(errors.handle) || undefined}
					aria-describedby={errors.handle ? "handle-error" : undefined}
					{...register("handle", {
						required: "Please specify a username",
					})}
				/>
				<InputError id="handle-error">{errors.handle?.message}</InputError>
			</InputGroup>
			<InputGroup>
				<InputLabel htmlFor="password">Password</InputLabel>
				<InputSimple
					id="password"
					type="password"
					autoComplete="off"
					aria-required
					aria-invalid={Boolean(errors.password) || Boolean(error) || undefined}
					aria-describedby={
						errors.password || error ? "password-error" : undefined
					}
					{...register("password", passwordRules)}
				/>
				<InputError id="password-error">
					{errors.password?.message || error}
				</InputError>
			</InputGroup>

			<div className="flex justify-between items-center mb-2.5">
				<Controller
					name="forceReset"
					control={control}
					render={({ field: { onChange, value } }) => (
						<Checkbox
							checked={value}
							id="ForceReset"
							label="Force user to reset password on login"
							onClick={() => onChange(!value)}
						/>
					)}
				/>
				<SaveButton />
			</div>
		</form>
	);
}
