import {
	type EmailSettingsUpdate,
	useUpdateEmailSettings,
} from "@administration/queries";
import { BoxGroup, BoxGroupSection } from "@base/Box";
import Field, { FieldDescription, FieldError, FieldLabel } from "@base/Field";
import Input from "@base/Input";
import SaveButton from "@base/SaveButton";
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
 * The identity mail is sent under.
 *
 * Saving the identity is its own mutation, so it cannot carry a half-typed API
 * key or test recipient along with it.
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

	function update(values: EmailSettingsUpdate) {
		mutation.mutate(values, { onSuccess: onSaved });
	}

	return (
		<BoxGroup>
			<BoxGroupSection>
				<form onSubmit={handleSubmit(update)}>
					<Field>
						<FieldLabel>Sender Name</FieldLabel>
						<Input {...register("senderName")} />
						<FieldError errors={[errors.senderName]} />
					</Field>
					<Field>
						<FieldLabel>Sender Address</FieldLabel>
						<Input
							{...register("senderAddress", {
								required: "A sender address is required.",
								pattern: {
									value: EMAIL_ADDRESS_PATTERN,
									message: "Invalid email address.",
								},
							})}
						/>
						<FieldError errors={[errors.senderAddress]} />
					</Field>
					<Field>
						<FieldLabel>Reply-To Address (optional)</FieldLabel>
						<FieldDescription className="mt-0 mb-1">
							Leave empty to send replies to the sender address.
						</FieldDescription>
						<Input
							{...register("replyToAddress", {
								validate: (value) =>
									value === "" ||
									EMAIL_ADDRESS_PATTERN.test(value) ||
									"Invalid email address.",
							})}
						/>
						<FieldError errors={[errors.replyToAddress]} />
					</Field>
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
