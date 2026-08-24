import Button from "@base/Button";
import { InputError, InputGroup, InputLabel, InputSimple } from "@base/Input";
import { usePasswordRules } from "@forms/password";
import { useNavigate } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { useCreateFirstUser } from "../queries";
import { WallContainer } from "./WallContainer";
import { WallTitle } from "./WallTitle";

type FormValues = {
	username: string;
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
			{ handle: data.username, password: data.password },
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
				<InputGroup>
					<InputLabel htmlFor="username">Username</InputLabel>
					<InputSimple
						aria-label="username"
						id="username"
						autoComplete="username"
						aria-required
						aria-invalid={Boolean(errors.username) || undefined}
						aria-describedby={errors.username ? "username-error" : undefined}
						{...register("username", {
							required: "Please provide a username",
						})}
					/>
					{errors.username?.message && (
						<InputError id="username-error">
							{errors.username.message}
						</InputError>
					)}
				</InputGroup>
				<InputGroup>
					<InputLabel htmlFor="password">Password</InputLabel>
					<InputSimple
						aria-label="password"
						id="password"
						type="password"
						autoComplete="new-password"
						aria-required
						aria-invalid={Boolean(errors.password) || undefined}
						aria-describedby={errors.password ? "password-error" : undefined}
						{...register("password", passwordRules)}
					/>
					{errors.password?.message && (
						<InputError id="password-error">
							{errors.password.message}
						</InputError>
					)}
				</InputGroup>

				<Button type="submit" color="blue">
					Create User
				</Button>
				{mutation.isError && (
					<InputError>
						{mutation.error.message || "Could not create user"}
					</InputError>
				)}
			</form>
		</WallContainer>
	);
}
