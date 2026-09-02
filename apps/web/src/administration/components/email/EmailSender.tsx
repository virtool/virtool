import {
	type EmailSettingsUpdate,
	useUpdateEmailSettings,
} from "@administration/queries";
import { BoxGroup, BoxGroupSection } from "@base/Box";
import Input, { InputError, InputGroup, InputLabel } from "@base/Input";
import SaveButton from "@base/SaveButton";
import Switch from "@base/Switch";
import type { EmailSettings } from "@virtool/contracts";
import { useForm } from "react-hook-form";
import { getEmailErrorMessage } from "./errors";

const EMAIL_ADDRESS_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type EmailSenderFormValues = {
	replyToAddress: string;
	senderAddress: string;
	senderName: string;
};

/**
 * The identity mail is sent under, and the switch that turns delivery on.
 *
 * The switch is its own mutation rather than a form field, so flipping it can
 * never carry half-typed sender values along with it. It can always be turned
 * off; turning it on needs a configuration the server has already resolved,
 * which is the only state that reports as disabled rather than unconfigured or
 * broken.
 */
export default function EmailSender({
	onSaved,
	settings,
}: {
	onSaved: () => void;
	settings: EmailSettings;
}) {
	const mutation = useUpdateEmailSettings();

	const {
		formState: { errors },
		handleSubmit,
		register,
	} = useForm<EmailSenderFormValues>({
		values: {
			replyToAddress: settings.replyToAddress,
			senderAddress: settings.senderAddress,
			senderName: settings.senderName,
		},
	});

	const canEnable = settings.enabled || settings.availability === "disabled";

	function update(values: EmailSettingsUpdate) {
		mutation.mutate(values, { onSuccess: onSaved });
	}

	return (
		<BoxGroup>
			<BoxGroupSection className="flex items-center justify-between gap-5">
				<div>
					<h3 className="font-medium">Send email</h3>
					<p className="text-gray-600 text-sm">
						Turning delivery off keeps the configuration and the stored key. It
						stops queued mail from being sent.
					</p>
				</div>
				<Switch
					aria-label="Send email"
					checked={settings.enabled}
					disabled={!canEnable || mutation.isPending}
					onCheckedChange={(enabled) => update({ enabled })}
				/>
			</BoxGroupSection>
			<BoxGroupSection>
				<form onSubmit={handleSubmit(update)}>
					<InputGroup>
						<InputLabel htmlFor="senderName">Sender Name</InputLabel>
						<Input
							id="senderName"
							aria-describedby="senderName-error"
							aria-invalid={Boolean(errors.senderName) || undefined}
							{...register("senderName")}
						/>
						<InputError id="senderName-error">
							{errors.senderName?.message}
						</InputError>
					</InputGroup>
					<InputGroup>
						<InputLabel htmlFor="senderAddress">Sender Address</InputLabel>
						<Input
							id="senderAddress"
							aria-describedby="senderAddress-error"
							aria-invalid={Boolean(errors.senderAddress) || undefined}
							{...register("senderAddress", {
								required: "A sender address is required.",
								pattern: {
									value: EMAIL_ADDRESS_PATTERN,
									message: "Invalid email address.",
								},
							})}
						/>
						<InputError id="senderAddress-error">
							{errors.senderAddress?.message}
						</InputError>
					</InputGroup>
					<InputGroup>
						<InputLabel htmlFor="replyToAddress">
							Reply-To Address (optional)
						</InputLabel>
						<p className="mb-1 text-gray-600 text-sm" id="replyToAddress-hint">
							Leave empty to send replies to the sender address.
						</p>
						<Input
							id="replyToAddress"
							aria-describedby="replyToAddress-hint replyToAddress-error"
							aria-invalid={Boolean(errors.replyToAddress) || undefined}
							{...register("replyToAddress", {
								validate: (value) =>
									value === "" ||
									EMAIL_ADDRESS_PATTERN.test(value) ||
									"Invalid email address.",
							})}
						/>
						<InputError id="replyToAddress-error">
							{errors.replyToAddress?.message}
						</InputError>
					</InputGroup>
					{mutation.isError ? (
						<p className="mb-2 text-red-600 text-sm" role="alert">
							{getEmailErrorMessage(mutation.error)}
						</p>
					) : null}
					<div className="flex justify-end">
						<SaveButton disabled={mutation.isPending} />
					</div>
				</form>
			</BoxGroupSection>
		</BoxGroup>
	);
}
