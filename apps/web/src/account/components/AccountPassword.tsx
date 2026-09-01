import { useTimedReset } from "@app/hooks";
import Alert from "@base/Alert";
import { BoxGroup, BoxGroupSection } from "@base/Box";
import FadeOut from "@base/FadeOut";
import {
	InputContainer,
	InputError,
	InputGroup,
	InputLabel,
	InputPassword,
} from "@base/Input";
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
			<SectionHeader>
				<h2>Password</h2>
			</SectionHeader>
			<BoxGroup>
				<form onSubmit={handleSubmit(onSubmit)}>
					<BoxGroupSection>
						<InputGroup>
							<InputLabel htmlFor="oldPassword">Old Password</InputLabel>
							<InputContainer align="right">
								<InputPassword
									id="oldPassword"
									autoComplete="current-password"
									aria-required
									aria-invalid={
										Boolean(errors.oldPassword) || mutation.isError || undefined
									}
									aria-describedby={
										errors.oldPassword || mutation.isError
											? "oldPassword-error"
											: undefined
									}
									{...register("oldPassword", {
										// No length rule. This authenticates the password the user
										// already has, and if the minimum were raised, checking it
										// here would lock a user with a shorter existing password out
										// of the very form that would replace it.
										required: "Please provide your old password",
									})}
								/>
								<InputError id="oldPassword-error">
									{errors.oldPassword?.message ||
										(mutation.isError && mutation.error.message)}
								</InputError>
							</InputContainer>
						</InputGroup>
						<InputGroup>
							<InputLabel htmlFor="newPassword">New Password</InputLabel>
							<InputContainer>
								<InputPassword
									id="newPassword"
									autoComplete="new-password"
									aria-required
									aria-invalid={Boolean(errors.newPassword) || undefined}
									aria-describedby={
										errors.newPassword ? "newPassword-error" : undefined
									}
									{...register("newPassword", passwordRules)}
								/>
								<InputError id="newPassword-error">
									{errors.newPassword?.message}
								</InputError>
							</InputContainer>
						</InputGroup>
						<FadeOut role="status">
							{mutation.isSuccess ? (
								<Alert color="green" icon={Check}>
									Password changed successfully
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
