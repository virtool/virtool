import { BoxGroup, BoxGroupSection } from "@base/Box";
import Checkbox from "@base/Checkbox";
import Field, { FieldError } from "@base/Field";
import Input from "@base/Input";
import RelativeTime from "@base/RelativeTime";
import SaveButton from "@base/SaveButton";
import SectionHeader from "@base/SectionHeader";
import { usePasswordRules } from "@forms/password";
import { useUpdateUser } from "@users/queries";
import { useForm } from "react-hook-form";
import RecoveryLink from "./RecoveryLink";

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
			<SectionHeader level={3}>
				<h3>Change Password</h3>
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
						<Field>
							<Input
								aria-label="password"
								type="password"
								autoComplete="new-password-for-other-user"
								aria-required
								{...register("password", passwordRules)}
							/>
							<FieldError
								errors={[
									errors.password,
									mutation.isError
										? { message: mutation.error.message }
										: undefined,
								]}
							/>
						</Field>

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
			<RecoveryLink userId={id} />
		</section>
	);
}
