import {
	useClearEmailApiKey,
	useSetEmailApiKey,
} from "@administration/queries";
import { BoxGroup, BoxGroupSection } from "@base/Box";
import Button from "@base/Button";
import DeleteDialog from "@base/DeleteDialog";
import { InputError, InputGroup, InputLabel, InputPassword } from "@base/Input";
import type { EmailSettings } from "@virtool/contracts";
import { useForm } from "react-hook-form";
import { getEmailErrorMessage } from "./errors";

const MAX_API_KEY_LENGTH = 256;

type EmailApiKeyFormValues = {
	apiKey: string;
};

/**
 * Store and remove the Resend API key.
 *
 * **The field starts empty however the key is stored.** The server reports only
 * whether one is configured, never the key itself, so there is nothing to fill
 * it in with. Saving replaces whatever is stored, and the value it replaces
 * cannot be read back.
 */
export default function EmailApiKey({ settings }: { settings: EmailSettings }) {
	const setKey = useSetEmailApiKey();
	const clearKey = useClearEmailApiKey();

	const {
		formState: { errors },
		handleSubmit,
		register,
		reset,
	} = useForm<EmailApiKeyFormValues>({ defaultValues: { apiKey: "" } });

	function save({ apiKey }: EmailApiKeyFormValues) {
		setKey.mutate(apiKey.trim(), {
			onSuccess: () => {
				reset();
			},
		});
	}

	const error = setKey.isError ? getEmailErrorMessage(setKey.error) : null;

	return (
		<BoxGroup>
			<BoxGroupSection>
				<form onSubmit={handleSubmit(save)}>
					<InputGroup>
						<InputLabel htmlFor="emailApiKey">Resend API Key</InputLabel>
						<p className="mb-1 text-gray-600 text-sm" id="emailApiKey-hint">
							Your key is kept secure and is not shown here. Enter a new key to
							replace the current one.
						</p>
						<div className="flex items-start gap-3">
							<div className="min-w-0 flex-1">
								<InputPassword
									id="emailApiKey"
									aria-describedby="emailApiKey-hint emailApiKey-status emailApiKey-error"
									aria-invalid={Boolean(errors.apiKey) || undefined}
									autoComplete="off"
									{...register("apiKey", {
										validate: (value) =>
											value.trim() !== "" || "An API key is required.",
										maxLength: {
											value: MAX_API_KEY_LENGTH,
											message: "That key is too long.",
										},
									})}
								/>
								<p
									className="mt-1 text-gray-600 text-sm"
									id="emailApiKey-status"
								>
									{settings.hasApiKey
										? "A key is configured."
										: "No key is configured."}
								</p>
							</div>
							{settings.hasApiKey ? (
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
							) : null}
							<Button color="blue" disabled={setKey.isPending} type="submit">
								{settings.hasApiKey ? "Replace Key" : "Save Key"}
							</Button>
						</div>
						<InputError id="emailApiKey-error">
							{errors.apiKey?.message}
						</InputError>
					</InputGroup>
					{error ? (
						<p className="mb-2 text-red-600 text-sm" role="alert">
							{error}
						</p>
					) : null}
				</form>
			</BoxGroupSection>
		</BoxGroup>
	);
}
