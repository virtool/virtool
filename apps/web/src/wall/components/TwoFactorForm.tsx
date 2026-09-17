import Button from "@base/Button";
import { InputGroup, InputLabel, InputSimple } from "@base/Input";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useVerifyTwoFactorMutation } from "../queries";
import { WallTitle } from "./WallTitle";

type TwoFactorFormProps = {
	redirect?: string;
	setResetRequired: (required: boolean) => void;
	restart: () => void;
};

export default function TwoFactorForm({
	redirect,
	setResetRequired,
	restart,
}: TwoFactorFormProps) {
	const [recovery, setRecovery] = useState(false);
	const { register, handleSubmit, reset } = useForm<{ code: string }>({
		defaultValues: { code: "" },
	});
	const mutation = useVerifyTwoFactorMutation();
	const navigate = useNavigate();

	function onSubmit({ code }: { code: string }) {
		mutation.mutate(
			{ code, recovery },
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

	return (
		<>
			<WallTitle
				title="Two-factor authentication"
				subtitle={
					recovery
						? "Enter one of your recovery codes."
						: "Enter the code from your authenticator app."
				}
			/>
			<form onSubmit={handleSubmit(onSubmit)}>
				<InputGroup>
					<InputLabel htmlFor="code">
						{recovery ? "Recovery code" : "Authentication code"}
					</InputLabel>
					<InputSimple
						id="code"
						autoComplete="one-time-code"
						autoFocus
						aria-required
						aria-invalid={mutation.isError || undefined}
						aria-describedby={
							mutation.isError ? "verification-error" : undefined
						}
						{...register("code", { required: true })}
					/>
				</InputGroup>
				{mutation.isError && (
					<div id="verification-error" role="alert">
						{mutation.error.message}
					</div>
				)}
				<div className="flex justify-end gap-2 my-4">
					<Button type="button" disabled={mutation.isPending} onClick={restart}>
						Back to login
					</Button>
					<Button type="submit" color="blue" disabled={mutation.isPending}>
						Verify
					</Button>
				</div>
				<Button
					type="button"
					disabled={mutation.isPending}
					onClick={() => {
						setRecovery(!recovery);
						reset();
						mutation.reset();
					}}
				>
					{recovery ? "Use authenticator code" : "Use recovery code"}
				</Button>
			</form>
		</>
	);
}
