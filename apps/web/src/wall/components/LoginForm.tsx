import Button from "@base/Button";
import Checkbox from "@base/Checkbox";
import InputGroup from "@base/InputGroup";
import InputLabel from "@base/InputLabel";
import InputSimple from "@base/InputSimple";
import { useNavigate } from "@tanstack/react-router";
import { CircleAlert } from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import { useLoginMutation } from "../queries";
import { WallTitle } from "./WallTitle";

type LoginFormProps = {
	/** URL to navigate to after a successful login. Defaults to "/". */
	redirect?: string;
	/** Callback to set the reset code in the parent component state. */
	setResetCode: (resetCode: string) => void;
};

type FormValues = {
	handle: string;
	password: string;
	remember: boolean;
};

/** Handles the user login process. */
export default function LoginForm({ redirect, setResetCode }: LoginFormProps) {
	const { control, handleSubmit, register } = useForm<FormValues>();
	const loginMutation = useLoginMutation();
	const navigate = useNavigate();

	function onSubmit({ handle, password, remember }: FormValues) {
		loginMutation.mutate(
			{ handle, password, remember },
			{
				onSuccess: (data) => {
					if (data.resetCode) {
						setResetCode(data.resetCode);
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
				<div className="flex justify-between my-4">
					<Controller
						name="remember"
						control={control}
						render={({ field: { onChange, value } }) => (
							<Checkbox
								checked={value}
								id="RememberMe"
								label="Remember Me"
								onClick={() => onChange(!value)}
							/>
						)}
					/>
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
