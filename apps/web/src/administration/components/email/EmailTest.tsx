import { useSendTestEmail } from "@administration/queries";
import { BoxGroup, BoxGroupSection } from "@base/Box";
import Button from "@base/Button";
import Input, { InputError, InputGroup, InputLabel } from "@base/Input";
import type { EmailSettings, EmailTestFailureCode } from "@virtool/contracts";
import { useEffect } from "react";
import { useForm } from "react-hook-form";

const EMAIL_ADDRESS_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const failureMessages: Record<EmailTestFailureCode, string> = {
	authentication:
		"The stored API key could not be used. Save a valid key or check the instance encryption key.",
	invalid_request:
		"Resend rejected the message. Check the sender address and that its domain is verified in Resend.",
	invalid_sender:
		"Resend rejected the sender address. Check it and that its domain is verified in Resend.",
	provider_unavailable: "Resend is unavailable. Try again shortly.",
	rate_limited: "Resend is rate limiting this account. Try again shortly.",
	timeout: "Resend did not answer in time. Try again shortly.",
	unavailable:
		"Email delivery is not usable yet. Finish the configuration above first.",
	unknown: "Resend refused the message. Check the configuration above.",
};

type EmailTestFormValues = {
	recipient: string;
};

/**
 * Send one test message with the stored configuration.
 *
 * The test never changes the configuration and never enqueues an
 * authentication template. It needs a configuration the server could resolve,
 * which is every state but unconfigured and broken — delivery being switched
 * off is exactly when an administrator wants to try it.
 */
export default function EmailTest({
	resetToken,
	settings,
}: {
	resetToken: number;
	settings: EmailSettings;
}) {
	const mutation = useSendTestEmail();

	useEffect(() => {
		mutation.reset();
	}, [mutation.reset, resetToken]);

	const {
		formState: { errors },
		handleSubmit,
		register,
	} = useForm<EmailTestFormValues>({ defaultValues: { recipient: "" } });

	const isUsable =
		settings.availability === "ready" || settings.availability === "disabled";

	function send({ recipient }: EmailTestFormValues) {
		mutation.mutate(recipient.trim());
	}

	return (
		<BoxGroup>
			<BoxGroupSection>
				<form onSubmit={handleSubmit(send)}>
					<InputGroup>
						<InputLabel htmlFor="testRecipient">Recipient</InputLabel>
						<p className="mb-1 text-gray-600 text-sm" id="testRecipient-hint">
							A successful test means Resend accepted the message. It is not
							proof the message reached the inbox.
						</p>
						<Input
							id="testRecipient"
							aria-describedby="testRecipient-hint testRecipient-error"
							aria-invalid={Boolean(errors.recipient) || undefined}
							disabled={!isUsable}
							{...register("recipient", {
								required: "A recipient is required.",
								setValueAs: (value: string) => value.trim(),
								pattern: {
									value: EMAIL_ADDRESS_PATTERN,
									message: "Invalid email address.",
								},
							})}
						/>
						<InputError id="testRecipient-error">
							{errors.recipient?.message}
						</InputError>
					</InputGroup>
					<div aria-live="polite" role="status">
						{mutation.isSuccess ? (
							<p className="mb-2 text-sm">
								{mutation.data.ok
									? "Resend accepted the test message. Check the recipient's mailbox to confirm it arrived."
									: failureMessages[mutation.data.code]}
							</p>
						) : null}
						{mutation.isError ? (
							<p className="mb-2 text-red-600 text-sm">
								Something went wrong. Please try again.
							</p>
						) : null}
					</div>
					<div className="flex justify-end">
						<Button
							color="blue"
							disabled={!isUsable || mutation.isPending}
							type="submit"
						>
							{mutation.isPending ? "Sending" : "Send Test Email"}
						</Button>
					</div>
				</form>
			</BoxGroupSection>
		</BoxGroup>
	);
}
