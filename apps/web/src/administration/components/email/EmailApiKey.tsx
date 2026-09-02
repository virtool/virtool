import {
	useClearEmailApiKey,
	useReencryptEmailApiKey,
	useSetEmailApiKey,
} from "@administration/queries";
import { BoxGroup, BoxGroupSection } from "@base/Box";
import Button from "@base/Button";
import DeleteDialog from "@base/DeleteDialog";
import { InputError, InputGroup, InputLabel, InputPassword } from "@base/Input";
import type { EmailReencryptResult, EmailSettings } from "@virtool/contracts";
import { useForm } from "react-hook-form";
import { getEmailErrorMessage } from "./errors";

const MAX_API_KEY_LENGTH = 256;

const reencryptMessages: Record<EmailReencryptResult, string> = {
	already_current: "The stored key is already under the active encryption key.",
	no_key: "There is no stored key to re-encrypt.",
	reencrypted:
		"The stored key was re-encrypted under the active encryption key.",
	unavailable:
		"The stored key could not be read. Check the encryption key this instance is running with.",
};

type EmailApiKeyFormValues = {
	apiKey: string;
};

/**
 * Store, replace, remove, and re-encrypt the Resend API key.
 *
 * **The field starts empty however the key is stored.** The server reports only
 * whether one is configured, never the key itself, so there is nothing to fill
 * it in with. Saving replaces whatever is stored, and the value it replaces
 * cannot be read back.
 */
export default function EmailApiKey({ settings }: { settings: EmailSettings }) {
	const setKey = useSetEmailApiKey();
	const clearKey = useClearEmailApiKey();
	const reencrypt = useReencryptEmailApiKey();

	const {
		formState: { errors },
		handleSubmit,
		register,
		reset,
	} = useForm<EmailApiKeyFormValues>({ defaultValues: { apiKey: "" } });

	function save({ apiKey }: EmailApiKeyFormValues) {
		setKey.mutate(apiKey.trim(), { onSuccess: () => reset() });
	}

	const failure = [setKey, reencrypt].find((mutation) => mutation.isError);
	const error = failure ? getEmailErrorMessage(failure.error) : null;

	return (
		<BoxGroup>
			<BoxGroupSection>
				<form onSubmit={handleSubmit(save)}>
					<InputGroup>
						<InputLabel htmlFor="emailApiKey">Resend API Key</InputLabel>
						<p className="mb-1 text-gray-600 text-sm" id="emailApiKey-hint">
							The key is stored encrypted and never sent back to this page.
							Saving a replacement cannot be undone by reading the old value.
						</p>
						<InputPassword
							id="emailApiKey"
							aria-describedby="emailApiKey-hint emailApiKey-error"
							aria-invalid={Boolean(errors.apiKey) || undefined}
							autoComplete="off"
							placeholder={
								settings.hasApiKey ? "A key is configured" : "No key configured"
							}
							{...register("apiKey", {
								required: "An API key is required.",
								maxLength: {
									value: MAX_API_KEY_LENGTH,
									message: "That key is too long.",
								},
							})}
						/>
						<InputError id="emailApiKey-error">
							{errors.apiKey?.message}
						</InputError>
					</InputGroup>
					{error ? (
						<p className="mb-2 text-red-600 text-sm" role="alert">
							{error}
						</p>
					) : null}
					{reencrypt.isSuccess ? (
						<p className="mb-2 text-gray-600 text-sm" role="status">
							{reencryptMessages[reencrypt.data]}
						</p>
					) : null}
					<div className="flex justify-end gap-2">
						{settings.hasApiKey ? (
							<>
								<Button
									disabled={reencrypt.isPending}
									onClick={() => reencrypt.mutate()}
									type="button"
								>
									Re-encrypt
								</Button>
								<DeleteDialog
									message={
										<>
											Removing the key makes email delivery unavailable and
											turns it off. The key cannot be recovered afterwards.
										</>
									}
									name="the stored Resend API key"
									noun="API Key"
									onConfirm={() => clearKey.mutateAsync()}
									trigger={<Button color="red">Remove</Button>}
								/>
							</>
						) : null}
						<Button color="blue" disabled={setKey.isPending} type="submit">
							{settings.hasApiKey ? "Replace Key" : "Save Key"}
						</Button>
					</div>
				</form>
			</BoxGroupSection>
		</BoxGroup>
	);
}
