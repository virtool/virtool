import {
	useClearNcbiApiKey,
	useFetchSettings,
	useSetNcbiApiKey,
} from "@administration/queries";
import Alert from "@base/Alert";
import { BoxGroup, BoxGroupSection } from "@base/Box";
import Button from "@base/Button";
import ExternalLink from "@base/ExternalLink";
import { InputError, InputGroup, InputLabel, InputPassword } from "@base/Input";
import LoadingPlaceholder from "@base/LoadingPlaceholder";
import QueryError from "@base/QueryError";
import SaveButton from "@base/SaveButton";
import SectionHeader from "@base/SectionHeader";
import { TriangleAlert } from "lucide-react";
import { useForm } from "react-hook-form";

const ENCRYPTION_KEY_DOCS =
	"https://github.com/virtool/virtool/blob/main/docs/env.md#encryption-key";

type NcbiApiKeyFormValues = {
	apiKey: string;
};

/**
 * Set or clear the instance's NCBI API key.
 *
 * The key raises the rate limit NCBI applies to the deployment's GenBank
 * lookups from three requests a second to ten.
 *
 * **The field starts empty however the setting is stored.** The server reports
 * only whether a key is configured and whether it can be decrypted, never the
 * key itself in either form, so there is nothing to fill it in with — saving
 * replaces whatever is stored and clearing removes it.
 */
export default function NcbiApiKey() {
	const { data, isPending, isError } = useFetchSettings();
	const setKey = useSetNcbiApiKey();
	const clearKey = useClearNcbiApiKey();

	const {
		formState: { errors },
		handleSubmit,
		register,
		reset,
	} = useForm<NcbiApiKeyFormValues>({ defaultValues: { apiKey: "" } });

	if (isError && !data) {
		return <QueryError noun="settings" />;
	}

	if (isPending) {
		return <LoadingPlaceholder />;
	}

	function save({ apiKey }: NcbiApiKeyFormValues) {
		setKey.mutate(apiKey.trim(), { onSuccess: () => reset() });
	}

	return (
		<section>
			<SectionHeader>
				<h2>NCBI API Key</h2>
				<p>
					Raise the rate limit NCBI applies to this instance when it looks up
					GenBank records.
				</p>
			</SectionHeader>
			<BoxGroup>
				{data.ncbiAvailability === "configuration_error" ? (
					<BoxGroupSection>
						<Alert color="red" icon={TriangleAlert} outerClassName="mb-0">
							<div aria-label="ncbi api key status" role="status">
								<h3 className="font-semibold">Configuration Error</h3>
								<p>
									The stored API key cannot be read with the encryption key this
									instance is running with. The key is still stored and has not
									been changed, and GenBank lookups continue at the rate limit
									NCBI applies without one. Restore the encryption key, or
									complete the rotation, by following{" "}
									<ExternalLink
										className="underline"
										href={ENCRYPTION_KEY_DOCS}
									>
										the encryption key guide
									</ExternalLink>
									.
								</p>
							</div>
						</Alert>
					</BoxGroupSection>
				) : null}
				<BoxGroupSection>
					<form onSubmit={handleSubmit(save)}>
						<InputGroup>
							<InputLabel htmlFor="ncbiApiKey">API Key</InputLabel>
							<InputPassword
								id="ncbiApiKey"
								aria-describedby="ncbiApiKey-error"
								aria-invalid={Boolean(errors.apiKey) || undefined}
								autoComplete="off"
								placeholder={
									data.hasNcbiApiKey
										? "A key is configured"
										: "No key configured"
								}
								{...register("apiKey", {
									required: "An API key is required.",
								})}
							/>
							<InputError id="ncbiApiKey-error">
								{errors.apiKey?.message}
							</InputError>
						</InputGroup>
						<div className="flex justify-end gap-2">
							{data.hasNcbiApiKey ? (
								<Button
									onClick={() => {
										clearKey.mutate(undefined, { onSuccess: () => reset() });
									}}
									type="button"
								>
									Remove
								</Button>
							) : null}
							<SaveButton />
						</div>
					</form>
				</BoxGroupSection>
			</BoxGroup>
		</section>
	);
}
