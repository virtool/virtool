import { accountQueryKeys } from "@account/keys";
import Alert from "@base/Alert";
import Button from "@base/Button";
import { InputError, InputGroup, InputLabel, InputSimple } from "@base/Input";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi, useNavigate } from "@tanstack/react-router";
import { MailCheck, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { rootQueryKeys } from "../keys";
import {
	emailRemediationQueryOptions,
	useCancelEmailRemediation,
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
	const cancel = useCancelEmailRemediation();
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const { error: searchError } = remediationRouteApi.useSearch();
	const [waitingForEmail, setWaitingForEmail] = useState(false);
	const { handleSubmit, register } = useForm<FormValues>({
		values: { email: data.email },
	});

	function onSubmit({ email }: FormValues) {
		submit.mutate(email, {
			onSuccess: (result) => {
				if (!result.complete) {
					setWaitingForEmail(true);
					return;
				}
				queryClient.removeQueries({ queryKey: rootQueryKeys.all() });
				queryClient.removeQueries({ queryKey: accountQueryKeys.all() });
				navigate({ to: "/" });
			},
		});
	}

	function onCancel() {
		cancel.mutate(undefined, {
			onSuccess: () => navigate({ to: "/login", replace: true }),
		});
	}

	return (
		<WallContainer>
			<WallTitle
				title="Add your email"
				subtitle="Your account needs a unique email address before you can continue."
			/>
			{searchError === "invalid-link" && (
				<Alert color="orange" icon={TriangleAlert}>
					That verification link is invalid or expired. Submit your email again
					to get a new link.
				</Alert>
			)}
			{waitingForEmail ? (
				<Alert color="blue" icon={MailCheck}>
					Check your email and open the verification link. You can leave this
					page open or return to it later.
				</Alert>
			) : (
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
			)}
			{waitingForEmail && (
				<div className="flex justify-end">
					<Button disabled={cancel.isPending} onClick={onCancel}>
						Cancel
					</Button>
				</div>
			)}
		</WallContainer>
	);
}
