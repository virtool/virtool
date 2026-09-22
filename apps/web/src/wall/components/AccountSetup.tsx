import Button from "@base/Button";
import { InputError, InputGroup, InputLabel, InputSimple } from "@base/Input";
import { usePasswordRules } from "@forms/password";
import {
	acceptAccountSetupFn,
	inspectAccountSetupFn,
} from "@server/auth/functions";
import { useNavigate } from "@tanstack/react-router";
import type { AccountSetupInspection } from "@virtool/contracts";
import { useLayoutEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { WallContainer } from "./WallContainer";
import { WallTitle } from "./WallTitle";

type FormValues = { password: string };

/** Public, token-bound account invitation acceptance wall. */
export default function AccountSetup() {
	const [inspection, setInspection] = useState<AccountSetupInspection | null>(
		null,
	);
	const [token, setToken] = useState<string | null>(null);
	const [submissionError, setSubmissionError] = useState("");
	const captured = useRef(false);
	const navigate = useNavigate();
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

	async function onSubmit({ password }: FormValues) {
		if (!token) {
			return;
		}
		setSubmissionError("");
		try {
			const result = await acceptAccountSetupFn({ data: { token, password } });
			setToken(null);
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
				title={`Welcome, ${inspection.handle}`}
				subtitle={`Create a password for the account assigned to ${inspection.email}.`}
			/>
			<form onSubmit={handleSubmit(onSubmit)}>
				<InputGroup>
					<InputLabel htmlFor="password">Password</InputLabel>
					<InputSimple
						id="password"
						type="password"
						autoComplete="new-password"
						aria-invalid={Boolean(errors.password) || undefined}
						{...register("password", passwordRules)}
					/>
					<InputError>{errors.password?.message}</InputError>
				</InputGroup>
				<Button type="submit" color="blue" disabled={isSubmitting}>
					Create account
				</Button>
				{submissionError && <InputError>{submissionError}</InputError>}
			</form>
		</WallContainer>
	);
}
