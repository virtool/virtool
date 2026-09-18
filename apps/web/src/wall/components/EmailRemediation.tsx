import { accountQueryKeys } from "@account/keys";
import Alert from "@base/Alert";
import Button from "@base/Button";
import { InputError, InputGroup, InputLabel, InputSimple } from "@base/Input";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi, useNavigate } from "@tanstack/react-router";
import { EMAIL_REMEDIATION_TOKEN_LIFETIME_HOURS } from "@virtool/contracts";
import { CircleCheck, MailCheck, TriangleAlert } from "lucide-react";
import { useForm } from "react-hook-form";
import { rootQueryKeys } from "../keys";
import {
	emailRemediationQueryOptions,
	useCancelEmailRemediation,
	useChangeEmailRemediation,
	usePromoteEmailRemediation,
	useResendEmailRemediation,
	useSubmitEmailRemediation,
} from "../queries";
import { WallContainer } from "./WallContainer";
import { WallTitle } from "./WallTitle";

type FormValues = {
	email: string;
};

const remediationRouteApi = getRouteApi("/email-remediation");

/** Minimum wall for completing a legacy account's email remediation. */
export default function EmailRemediation() {
	const { data } = useSuspenseQuery(emailRemediationQueryOptions());
	const submit = useSubmitEmailRemediation();
	const resend = useResendEmailRemediation();
	const changeEmail = useChangeEmailRemediation();
	const promote = usePromoteEmailRemediation();
	const cancel = useCancelEmailRemediation();
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const { redirect } = remediationRouteApi.useSearch();
	const { handleSubmit, register } = useForm<FormValues>({
		defaultValues: { email: "" },
	});

	function enterApplication() {
		queryClient.removeQueries({ queryKey: rootQueryKeys.all() });
		queryClient.removeQueries({ queryKey: accountQueryKeys.all() });
		navigate({ to: redirect ?? "/" });
	}

	function onSubmit({ email }: FormValues) {
		submit.mutate(
			{ email, redirect },
			{
				onSuccess: (result) => {
					if (!result.complete) {
						queryClient.setQueryData(
							emailRemediationQueryOptions().queryKey,
							result.state,
						);
						return;
					}
					enterApplication();
				},
			},
		);
	}

	function onCancel() {
		cancel.mutate(undefined, {
			onSuccess: () => {
				queryClient.removeQueries({
					queryKey: emailRemediationQueryOptions().queryKey,
				});
				queryClient.removeQueries({ queryKey: accountQueryKeys.all() });
				navigate({
					to: "/login",
					replace: true,
					search: { redirect },
				});
			},
		});
	}

	function onResend() {
		resend.mutate(
			{ redirect },
			{
				onSuccess: (result) => {
					if (result.complete) {
						enterApplication();
						return;
					}
					queryClient.setQueryData(
						emailRemediationQueryOptions().queryKey,
						result.state,
					);
				},
			},
		);
	}

	function onChangeEmail() {
		changeEmail.mutate(undefined, {
			onSuccess: (state) => {
				queryClient.setQueryData(
					emailRemediationQueryOptions().queryKey,
					state,
				);
			},
		});
	}

	function onContinue() {
		promote.mutate(undefined, { onSuccess: enterApplication });
	}

	return (
		<WallContainer>
			{data.status === "input" && (
				<>
					<WallTitle
						title="Add your email"
						subtitle="Your account needs a unique email address before you can continue."
					/>
					<form onSubmit={handleSubmit(onSubmit)}>
						<InputGroup>
							<InputLabel htmlFor="email">Email address</InputLabel>
							<InputSimple
								id="email"
								type="email"
								autoComplete="email"
								aria-required
								aria-invalid={submit.isError || undefined}
								aria-describedby={
									submit.isError ? "remediation-error" : undefined
								}
								{...register("email", { required: true })}
								autoFocus
							/>
							{submit.isError && (
								<InputError id="remediation-error">
									{submit.error.message ||
										"Email remediation could not be completed."}
								</InputError>
							)}
						</InputGroup>
						<div className="flex justify-between">
							<Button
								type="button"
								disabled={submit.isPending || cancel.isPending}
								onClick={onCancel}
							>
								Cancel
							</Button>
							<Button type="submit" color="blue" disabled={submit.isPending}>
								Continue
							</Button>
						</div>
					</form>
				</>
			)}
			{data.status === "pending" && (
				<>
					<WallTitle
						title="Check your email"
						subtitle={`We sent a verification link to ${data.maskedEmail}.`}
					/>
					<Alert color="blue" icon={MailCheck}>
						Open the link in any browser. It remains valid for up to{" "}
						{EMAIL_REMEDIATION_TOKEN_LIFETIME_HOURS} hours after it was sent.
					</Alert>
					{data.deliveryFailed && (
						<Alert color="orange" icon={TriangleAlert}>
							The message could not be sent. Resend it or choose another email
							address.
						</Alert>
					)}
					{resend.isError && <InputError>{resend.error.message}</InputError>}
					<div className="flex flex-wrap justify-between gap-2">
						<Button
							disabled={cancel.isPending || changeEmail.isPending}
							onClick={onCancel}
						>
							Cancel
						</Button>
						<div className="flex gap-2">
							<Button disabled={changeEmail.isPending} onClick={onChangeEmail}>
								Change email
							</Button>
							<Button
								color="blue"
								disabled={!data.canResend || resend.isPending}
								onClick={onResend}
							>
								Resend
							</Button>
						</div>
					</div>
				</>
			)}
			{data.status === "verified" && (
				<>
					<WallTitle
						title="Email verified"
						subtitle="Your email was verified in another browser."
					/>
					<Alert color="green" icon={CircleCheck}>
						You can continue to Virtool in this browser.
					</Alert>
					<div className="flex justify-end">
						<Button
							color="blue"
							disabled={promote.isPending}
							onClick={onContinue}
						>
							Continue
						</Button>
					</div>
				</>
			)}
		</WallContainer>
	);
}
