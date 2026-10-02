import { useTimedReset } from "@app/hooks";
import { isRecentAuthenticationCancelled } from "@app/recentAuthentication";
import { BoxGroup, BoxGroupSection } from "@base/Box";
import Button from "@base/Button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogTitle,
	DialogTrigger,
} from "@base/Dialog";
import FadeOut from "@base/FadeOut";
import Field, { FieldError, FieldLabel } from "@base/Field";
import { InputPassword } from "@base/Input";
import RelativeTime from "@base/RelativeTime";
import SaveButton from "@base/SaveButton";
import SectionHeader from "@base/SectionHeader";
import { usePasswordRules } from "@forms/password";
import { Check } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useChangePassword } from "../queries";

type FormValues = {
	oldPassword: string;
	newPassword: string;
};

type PasswordFormProps = {
	mutation: ReturnType<typeof useChangePassword>;
	onChanged: () => void;
};

function PasswordForm({ mutation, onChanged }: PasswordFormProps) {
	const {
		formState: { errors },
		handleSubmit,
		register,
	} = useForm<FormValues>({
		defaultValues: { oldPassword: "", newPassword: "" },
	});
	const passwordRules = usePasswordRules();

	function onSubmit({ oldPassword, newPassword }: FormValues) {
		mutation.mutate(
			{ oldPassword, password: newPassword },
			{ onSuccess: onChanged },
		);
	}

	const serverError =
		mutation.isError && !isRecentAuthenticationCancelled(mutation.error)
			? { message: mutation.error.message }
			: undefined;

	return (
		<form onSubmit={handleSubmit(onSubmit)}>
			<Field>
				<FieldLabel>Current password</FieldLabel>
				<InputPassword
					autoComplete="current-password"
					aria-required
					{...register("oldPassword", {
						// No length rule. This authenticates the password the user
						// already has, and if the minimum were raised, checking it
						// here would lock a user with a shorter existing password out
						// of the very form that would replace it.
						required: "Please provide your current password",
					})}
				/>
				<FieldError errors={[errors.oldPassword, serverError]} />
			</Field>
			<Field>
				<FieldLabel>New password</FieldLabel>
				<InputPassword
					autoComplete="new-password"
					aria-required
					{...register("newPassword", passwordRules)}
				/>
				<FieldError errors={[errors.newPassword]} />
			</Field>
			<DialogFooter>
				<SaveButton altText="Change" disabled={mutation.isPending} />
			</DialogFooter>
		</form>
	);
}

type ChangePasswordProps = {
	/** The date of the most recent password change */
	lastPasswordChange: Date;
};

/**
 * Shows when the password last changed, with a dialog that changes it.
 */
export default function AccountPassword({
	lastPasswordChange,
}: ChangePasswordProps) {
	const [open, setOpen] = useState(false);
	const mutation = useChangePassword();

	useTimedReset(mutation.isSuccess, mutation.reset);

	function handleOpenChange(next: boolean) {
		if (next) {
			mutation.reset();
		}
		setOpen(next);
	}

	return (
		<section aria-labelledby="account-password">
			<SectionHeader level={3}>
				<h3 id="account-password">Password</h3>
			</SectionHeader>
			<BoxGroup>
				<BoxGroupSection className="flex items-center justify-between gap-4">
					<div className="flex flex-col gap-1">
						<span>
							Last changed <RelativeTime time={lastPasswordChange} />
						</span>
						<FadeOut className="text-green-700 text-sm" role="status">
							{mutation.isSuccess ? (
								<span className="flex items-center gap-1">
									<Check className="size-4" />
									Password changed. Other browsers were signed out.
								</span>
							) : null}
						</FadeOut>
					</div>
					<Dialog open={open} onOpenChange={handleOpenChange}>
						<Button as={DialogTrigger} color="blue">
							Change
						</Button>
						<DialogContent>
							<DialogTitle>Change password</DialogTitle>
							<DialogDescription>
								Other browsers are signed out when your password changes.
							</DialogDescription>
							<PasswordForm
								mutation={mutation}
								onChanged={() => setOpen(false)}
							/>
						</DialogContent>
					</Dialog>
				</BoxGroupSection>
			</BoxGroup>
		</section>
	);
}
