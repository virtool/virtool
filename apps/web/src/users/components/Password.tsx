import { BoxGroup, BoxGroupSection } from "@base/Box";
import Checkbox from "@base/Checkbox";
import {
	InputContainer,
	InputError,
	InputGroup,
	InputSimple,
} from "@base/Input";
import RelativeTime from "@base/RelativeTime";
import SaveButton from "@base/SaveButton";
import SectionHeader from "@base/SectionHeader";
import { usePasswordRules } from "@forms/password";
import { useUpdateUser } from "@users/queries";
import { useForm } from "react-hook-form";

type PasswordProps = {
	/** The users unique id */
	id: number;
	/** Whether the user will be forced to reset their password on next login */
	forceReset: boolean;
	/** The date of their last password change */
	lastPasswordChange: Date;
};

/**
 * The password view to handle password change
 */
export default function Password({
	id,
	forceReset,
	lastPasswordChange,
}: PasswordProps) {
	const mutation = useUpdateUser();
	const passwordRules = usePasswordRules();
	const {
		formState: { errors },
		handleSubmit,
		register,
	} = useForm({ defaultValues: { password: "" } });

	function handleSetForceReset() {
		mutation.mutate({
			userId: id,
			update: {
				forceReset: !forceReset,
			},
		});
	}

	return (
		<section>
			<SectionHeader>
				<h2>Change Password</h2>
				<p>
					Last changed <RelativeTime time={lastPasswordChange} />
				</p>
			</SectionHeader>
			<BoxGroup>
				<BoxGroupSection>
					<form
						onSubmit={handleSubmit((values) =>
							mutation.mutate({
								userId: id,
								update: { password: values.password },
							}),
						)}
					>
						<InputGroup>
							<InputContainer>
								<InputSimple
									aria-label="password"
									id="password"
									type="password"
									autoComplete="new-password-for-other-user"
									aria-required
									aria-invalid={
										Boolean(errors.password) || mutation.isError || undefined
									}
									aria-describedby={
										errors.password || mutation.isError
											? "password-error"
											: undefined
									}
									{...register("password", passwordRules)}
								/>
								<InputError id="password-error">
									{errors.password?.message ||
										(mutation.isError && mutation.error.message)}
								</InputError>
							</InputContainer>
						</InputGroup>

						<div className="flex items-center justify-between">
							<Checkbox
								checked={forceReset}
								id="ForceReset"
								label="Force user to reset password on next login"
								onClick={handleSetForceReset}
							/>
							<SaveButton />
						</div>
					</form>
				</BoxGroupSection>
			</BoxGroup>
		</section>
	);
}
