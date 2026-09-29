import { accountQueryKeys } from "@account/keys";
import Button from "@base/Button";
import Field, { FieldError, FieldLabel } from "@base/Field";
import Input from "@base/Input";
import { usePasswordRules } from "@forms/password";
import {
	acceptAccountSetupFn,
	inspectAccountSetupFn,
} from "@server/auth/functions";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import type { AccountSetupInspection } from "@virtool/contracts";
import { rootQueryKeys } from "@wall/keys";
import { useLayoutEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { WallContainer } from "./WallContainer";
import { WallTitle } from "./WallTitle";

type FormValues = { handle: string; password: string };

/** Public, token-bound account invitation acceptance wall. */
export default function AccountSetup() {
	const [inspection, setInspection] = useState<AccountSetupInspection | null>(
		null,
	);
	const [token, setToken] = useState<string | null>(null);
	const [submissionError, setSubmissionError] = useState("");
	const captured = useRef(false);
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const passwordRules = usePasswordRules();
	const {
		formState: { errors, isSubmitting },
		handleSubmit,
		register,
	} = useForm<FormValues>();

	useLayoutEffect(() => {
		if (captured.current) {
			return;
		}
		captured.current = true;
		const fragment = new URLSearchParams(window.location.hash.slice(1));
		const capturedToken = fragment.get("token");
		window.history.replaceState(
			window.history.state,
			"",
			window.location.pathname,
		);
		if (!capturedToken || !/^[0-9a-f]{64}$/.test(capturedToken)) {
			setInspection({ status: "unusable" });
			return;
		}
		setToken(capturedToken);
		void inspectAccountSetupFn({ data: { token: capturedToken } })
			.then(setInspection)
			.catch(() => setInspection({ status: "unusable" }));
	}, []);

	async function onSubmit({ handle, password }: FormValues) {
		if (!token) {
			return;
		}
		setSubmissionError("");
		try {
			const result = await acceptAccountSetupFn({
				data: { token, handle, password },
			});
			setToken(null);
			queryClient.removeQueries({ queryKey: rootQueryKeys.all() });
			queryClient.removeQueries({ queryKey: accountQueryKeys.all() });
			await navigate({ to: result.nextRoute });
		} catch (error) {
			setSubmissionError(
				error instanceof Error ? error.message : "Account setup failed.",
			);
		}
	}

	if (!inspection) {
		return (
			<WallContainer>
				<WallTitle
					title="Set up account"
					subtitle="Checking your invitation…"
				/>
			</WallContainer>
		);
	}
	if (inspection.status === "unusable") {
		return (
			<WallContainer>
				<WallTitle
					title="Invitation unavailable"
					subtitle="This account setup link cannot be used. Ask an administrator for a new invitation."
				/>
			</WallContainer>
		);
	}

	return (
		<WallContainer>
			<WallTitle
				title="Set up your account"
				subtitle={`Choose a username and password for ${inspection.email}.`}
			/>
			<form onSubmit={handleSubmit(onSubmit)}>
				<Field>
					<FieldLabel>Username</FieldLabel>
					<Input
						autoComplete="username"
						{...register("handle", { required: "Please choose a username" })}
					/>
					<FieldError errors={[errors.handle]} />
				</Field>
				<Field>
					<FieldLabel>Password</FieldLabel>
					<Input
						type="password"
						autoComplete="new-password"
						{...register("password", passwordRules)}
					/>
					<FieldError errors={[errors.password]} />
				</Field>
				<Button type="submit" color="blue" disabled={isSubmitting}>
					Create account
				</Button>
				{submissionError && <FieldError>{submissionError}</FieldError>}
			</form>
		</WallContainer>
	);
}
