import { formatDate } from "@app/date";
import Button from "@base/Button";
import Field, { FieldError, FieldLabel } from "@base/Field";
import Input from "@base/Input";
import { usePasswordRules } from "@forms/password";
import {
	acceptAccountSetupFn,
	inspectAccountSetupFn,
} from "@server/auth/functions";
import { Link } from "@tanstack/react-router";
import type { AccountSetupInspection } from "@virtool/contracts";
import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { getWallErrorMessage } from "../errors";
import { useCapturedUrlParams, useFollowAuthNextStep } from "../hooks";
import { WallContainer } from "./WallContainer";
import { WallTitle } from "./WallTitle";

type FormValues = { handle: string; password: string; confirmPassword: string };

type SetupState =
	| { status: "loading" }
	| { status: "unusable" }
	| { status: "ready"; token: string; email: string; expiresAt: Date }
	| { status: "verification_queued"; email: string }
	| { status: "accepted" };

/** The public wall that accepts an invitation link. */
export default function AccountSetup() {
	const [state, setState] = useState<SetupState>({ status: "loading" });
	const [submissionError, setSubmissionError] = useState("");
	const submitting = useRef(false);
	const follow = useFollowAuthNextStep();
	const passwordRules = usePasswordRules();
	const {
		formState: { errors, isSubmitting },
		getValues,
		handleSubmit,
		register,
	} = useForm<FormValues>();

	useCapturedUrlParams(["token"], ({ token }) => {
		if (!token || !/^[0-9a-f]{64}$/.test(token)) {
			setState({ status: "unusable" });
			return;
		}
		void inspectAccountSetupFn({ data: { token } })
			.then((inspection: AccountSetupInspection) =>
				setState(
					inspection.status === "valid"
						? {
								status: "ready",
								token,
								email: inspection.email,
								expiresAt: inspection.expiresAt,
							}
						: { status: "unusable" },
				),
			)
			.catch(() => setState({ status: "unusable" }));
	});

	async function onSubmit({ handle, password }: FormValues) {
		if (state.status !== "ready" || submitting.current) {
			return;
		}
		submitting.current = true;
		setSubmissionError("");
		try {
			const result = await acceptAccountSetupFn({
				data: { token: state.token, handle, password },
			});
			if (result.emailVerificationRequired) {
				setState({ status: "verification_queued", email: state.email });
				return;
			}
		} catch (error) {
			setSubmissionError(
				getWallErrorMessage(error, "Account setup failed. Try again."),
			);
			return;
		} finally {
			submitting.current = false;
		}
		// The invitation is spent, so a failure here must not look like a failed
		// setup.
		await follow().catch(() => setState({ status: "accepted" }));
	}

	if (state.status === "loading") {
		return (
			<WallContainer>
				<WallTitle
					title="Set up account"
					subtitle="Checking your invitation…"
				/>
			</WallContainer>
		);
	}

	if (state.status === "unusable") {
		return (
			<WallContainer>
				<WallTitle
					title="Invitation unavailable"
					subtitle="This account setup link cannot be used. Ask an administrator for a new invitation."
				/>
				<Link to="/login">Go to sign in</Link>
			</WallContainer>
		);
	}

	if (state.status === "accepted") {
		return (
			<WallContainer>
				<WallTitle
					title="Your account is ready"
					subtitle="Virtool could not be reached to finish signing you in."
				/>
				<Button
					color="blue"
					onClick={() => void follow().catch(() => undefined)}
				>
					Continue to Virtool
				</Button>
			</WallContainer>
		);
	}

	if (state.status === "verification_queued") {
		return (
			<WallContainer>
				<WallTitle
					title="Check your email"
					subtitle={`Your account is ready. A link to verify ${state.email} is on its way.`}
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
				title="Set up your account"
				subtitle={`Choose a username and password for ${state.email}.`}
			/>
			<p className="mb-4 text-gray-600">
				This link works one time and expires on {formatDate(state.expiresAt)}.
			</p>
			<form onSubmit={handleSubmit(onSubmit)}>
				<Field>
					<FieldLabel>Username</FieldLabel>
					<Input
						autoComplete="username"
						aria-required
						{...register("handle", { required: "Please choose a username" })}
					/>
					<FieldError errors={[errors.handle]} />
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
				<Button type="submit" color="blue" disabled={isSubmitting}>
					Create account
				</Button>
				{submissionError && (
					<p role="alert" className="mt-2 font-medium text-red-600">
						{submissionError}
					</p>
				)}
			</form>
		</WallContainer>
	);
}
