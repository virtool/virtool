import Button from "@base/Button";
import Field, { FieldError, FieldLabel } from "@base/Field";
import Input from "@base/Input";
import { usePasswordRules } from "@forms/password";
import { useNavigate } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { useCreateFirstUser } from "../queries";
import { WallContainer } from "./WallContainer";
import { WallTitle } from "./WallTitle";

type FormValues = {
	username: string;
	email: string;
	password: string;
};

/**
 * A form for creating the first instance user
 */
export default function FirstUser() {
	const mutation = useCreateFirstUser();
	const navigate = useNavigate();
	const passwordRules = usePasswordRules();

	const {
		formState: { errors },
		handleSubmit,
		register,
	} = useForm<FormValues>();

	function onSubmit(data: FormValues) {
		mutation.mutate(
			{ handle: data.username, email: data.email, password: data.password },
			{ onSuccess: () => navigate({ to: "/" }) },
		);
	}

	return (
		<WallContainer>
			<WallTitle
				title="Create First User"
				subtitle="Create an administrative user that can be used to configure your new Virtool instance."
			/>

			<form onSubmit={handleSubmit(onSubmit)}>
				<Field>
					<FieldLabel>Username</FieldLabel>
					<Input
						autoComplete="username"
						aria-required
						{...register("username", {
							required: "Please provide a username",
						})}
					/>
					<FieldError errors={[errors.username]} />
				</Field>
				<Field>
					<FieldLabel>Email</FieldLabel>
					<Input
						type="email"
						autoComplete="email"
						aria-required
						{...register("email", {
							required: "Please provide an email address",
						})}
					/>
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

				<Button type="submit" color="blue">
					Create User
				</Button>
				{mutation.isError && (
					<FieldError>
						{mutation.error.message || "Could not create user"}
					</FieldError>
				)}
			</form>
		</WallContainer>
	);
}
