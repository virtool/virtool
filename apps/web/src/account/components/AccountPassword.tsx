import { useTimedReset } from "@app/hooks";
import Alert from "@base/Alert";
import { BoxGroup, BoxGroupSection } from "@base/Box";
import FadeOut from "@base/FadeOut";
import Field, { FieldError, FieldLabel } from "@base/Field";
import { InputPassword } from "@base/Input";
import RelativeTime from "@base/RelativeTime";
import SaveButton from "@base/SaveButton";
import SectionHeader from "@base/SectionHeader";
import { usePasswordRules } from "@forms/password";
import { Check } from "lucide-react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { useChangePassword } from "../queries";

type FormValues = {
	oldPassword: string;
	newPassword: string;
};

type ChangePasswordProps = {
	/** The date of the most recent password change */
	lastPasswordChange: Date;
};

/**
 * A component to update the accounts password
 */
export default function AccountPassword({
	lastPasswordChange,
}: ChangePasswordProps) {
	const {
		formState: { errors },
		handleSubmit,
		register,
		reset,
	} = useForm<FormValues>({
		defaultValues: { oldPassword: "", newPassword: "" },
	});
	const mutation = useChangePassword();
	const passwordRules = usePasswordRules();

	useEffect(() => {
		if (mutation.isSuccess) {
			reset();
		}
	}, [mutation.isSuccess, reset]);

	useTimedReset(mutation.isSuccess, mutation.reset);

	function onSubmit({ oldPassword, newPassword }: FormValues) {
		mutation.mutate({ oldPassword, password: newPassword });
	}

	return (
		<section>
			<SectionHeader level={3}>
				<h3>Password</h3>
			</SectionHeader>
			<BoxGroup>
				<form onSubmit={handleSubmit(onSubmit)}>
					<BoxGroupSection>
						<Field>
							<FieldLabel>Old Password</FieldLabel>
							<InputPassword
								autoComplete="current-password"
								aria-required
								{...register("oldPassword", {
									// No length rule. This authenticates the password the user
									// already has, and if the minimum were raised, checking it
									// here would lock a user with a shorter existing password out
									// of the very form that would replace it.
									required: "Please provide your old password",
								})}
							/>
							<FieldError
								errors={[
									errors.oldPassword,
									mutation.isError
										? { message: mutation.error.message }
										: undefined,
								]}
							/>
						</Field>
						<Field>
							<FieldLabel>New Password</FieldLabel>
							<InputPassword
								autoComplete="new-password"
								aria-required
								{...register("newPassword", passwordRules)}
							/>
							<FieldError errors={[errors.newPassword]} />
						</Field>
						<FadeOut role="status">
							{mutation.isSuccess ? (
								<Alert color="green" icon={Check}>
									Password changed. Other browsers were signed out.
								</Alert>
							) : null}
						</FadeOut>
						<div className="flex items-center justify-between mb-4">
							<span>
								Last changed <RelativeTime time={lastPasswordChange} />
							</span>
							<SaveButton altText="Change" disabled={mutation.isPending} />
						</div>
					</BoxGroupSection>
				</form>
			</BoxGroup>
		</section>
	);
}
