import Button from "@base/Button";
import { InputGroup, InputLabel, InputSimple } from "@base/Input";
import { useNavigate } from "@tanstack/react-router";
import { CircleAlert } from "lucide-react";
import { useForm } from "react-hook-form";
import { useLoginMutation } from "../queries";
import { WallTitle } from "./WallTitle";

type LoginFormProps = {
	/** URL to navigate to after a successful login. Defaults to "/". */
	redirect?: string;
	/** Shows the forced-reset form after the password has been authenticated. */
	setResetRequired: (required: boolean) => void;
};

type FormValues = {
	handle: string;
	password: string;
};

/** Handles the user login process. */
export default function LoginForm({
	redirect,
	setResetRequired,
}: LoginFormProps) {
	const { handleSubmit, register } = useForm<FormValues>();
	const loginMutation = useLoginMutation();
	const navigate = useNavigate();

	function onSubmit({ handle, password }: FormValues) {
		loginMutation.mutate(
			{ handle, password },
			{
				onSuccess: (data) => {
					if (data.reset) {
						setResetRequired(true);
						return;
					}
					navigate({ to: redirect ?? "/" });
				},
			},
		);
	}

	const { error, isError } = loginMutation;

	return (
		<>
			<WallTitle title="Login" subtitle="Login with your Virtool account." />

			<form onSubmit={handleSubmit(onSubmit)}>
				<InputGroup>
					<InputLabel htmlFor="handle">Username</InputLabel>
					<InputSimple
						id="handle"
						autoComplete="username"
						aria-required
						aria-invalid={isError || undefined}
						aria-describedby={isError ? "login-error" : undefined}
						{...register("handle", { required: true })}
						autoFocus
					/>
				</InputGroup>
				<InputGroup>
					<InputLabel htmlFor="password">Password</InputLabel>
					<InputSimple
						id="password"
						type="password"
						autoComplete="current-password"
						aria-required
						aria-invalid={isError || undefined}
						aria-describedby={isError ? "login-error" : undefined}
						{...register("password", { required: true })}
					/>
				</InputGroup>
				<div className="flex justify-end my-4">
					{isError && (
						<div
							id="login-error"
							role="alert"
							className="flex items-center gap-1 text-red-600 font-medium"
						>
							<CircleAlert aria-hidden className="shrink-0" size={14} />
							{error?.message || "An error occurred during login"}
						</div>
					)}
				</div>
				<div className="flex justify-end">
					<Button type="submit" color="blue">
						Login
					</Button>
				</div>
			</form>
		</>
	);
}
