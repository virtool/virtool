import { getErrorStatus } from "@app/queryErrors";
import Button from "@base/Button";
import Field, { FieldDescription, FieldError, FieldLabel } from "@base/Field";
import Input from "@base/Input";
import { usePasswordRules } from "@forms/password";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { getWallErrorMessage } from "../errors";
import { useFollowAuthNextStep } from "../hooks";
import { useCreateFirstUser } from "../queries";
import { WallContainer } from "./WallContainer";
import { WallTitle } from "./WallTitle";

type FormValues = {
	handle: string;
	email: string;
	password: string;
	confirmPassword: string;
};

/**
 * A form that creates the first user of a new instance.
 *
 * It works without email delivery. A verification email is sent only when
 * delivery is set up.
 */
export default function FirstUser() {
	const mutation = useCreateFirstUser();
	const navigate = useNavigate();
	const follow = useFollowAuthNextStep();
	const passwordRules = usePasswordRules();
	const [verificationQueued, setVerificationQueued] = useState(false);

	const {
		formState: { errors },
		getValues,
		handleSubmit,
		register,
	} = useForm<FormValues>();

	function onSubmit({ handle, email, password }: FormValues) {
		if (mutation.isPending) {
			return;
		}
		mutation.mutate(
			{ handle, email, password },
			{
				onSuccess: (result) => {
					if (result.emailVerificationRequired) {
						setVerificationQueued(true);
						return;
					}
					void follow();
				},
				onError: (error) => {
					// Another browser finished setup first.
					if (getErrorStatus(error) === 409) {
						void navigate({
							to: "/login",
							replace: true,
							search: { reason: "setup-complete" },
						});
					}
				},
			},
		);
	}

	if (verificationQueued) {
		return (
			<WallContainer>
				<WallTitle
					title="Check your email"
					subtitle="Your account is ready. A verification link is on its way to your email address."
				/>
				<Button color="blue" onClick={() => void follow()}>
					Continue to Virtool
				</Button>
			</WallContainer>
		);
	}

	return (
		<WallContainer>
			<WallTitle
				title="Set up Virtool"
				subtitle="Create the first administrator. You can use this account to configure Virtool and invite other users."
			/>

			<form onSubmit={handleSubmit(onSubmit)}>
				<Field>
					<FieldLabel>Username</FieldLabel>
					<Input
						autoComplete="username"
						aria-required
						{...register("handle", {
							required: "Please provide a username",
						})}
					/>
					<FieldError errors={[errors.handle]} />
				</Field>
				<Field>
					<FieldLabel>Email</FieldLabel>
					<Input
						type="email"
						autoComplete="email"
						inputMode="email"
						aria-required
						{...register("email", {
							required: "Please provide an email address",
						})}
					/>
					<FieldDescription>
						If email delivery is set up, Virtool sends a link to verify this
						address. You do not need email to finish setup.
					</FieldDescription>
					<FieldError errors={[errors.email]} />
				</Field>
				<Field>
					<FieldLabel>Password</FieldLabel>
					<Input
						type="password"
						autoComplete="new-password"
						aria-required
						{...register("password", passwordRules)}
					/>
					<FieldError errors={[errors.password]} />
				</Field>
				<Field>
					<FieldLabel>Confirm password</FieldLabel>
					<Input
						type="password"
						autoComplete="new-password"
						aria-required
						{...register("confirmPassword", {
							required: "Please confirm the password",
							validate: (value) =>
								value === getValues("password") || "The passwords do not match",
						})}
					/>
					<FieldError errors={[errors.confirmPassword]} />
				</Field>

				<Button type="submit" color="blue" disabled={mutation.isPending}>
					Create administrator
				</Button>
				{mutation.isError && getErrorStatus(mutation.error) !== 409 && (
					<FieldError>
						{getWallErrorMessage(
							mutation.error,
							"Could not create the administrator. Try again.",
						)}
					</FieldError>
				)}
			</form>
		</WallContainer>
	);
}
