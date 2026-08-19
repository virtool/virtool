import { useFetchSettings, useUpdateSettings } from "@administration/queries";
import BoxGroup from "@base/BoxGroup";
import BoxGroupSection from "@base/BoxGroupSection";
import Button from "@base/Button";
import InputError from "@base/InputError";
import InputGroup from "@base/InputGroup";
import InputLabel from "@base/InputLabel";
import InputPassword from "@base/InputPassword";
import LoadingPlaceholder from "@base/LoadingPlaceholder";
import QueryError from "@base/QueryError";
import SaveButton from "@base/SaveButton";
import SectionHeader from "@base/SectionHeader";
import { useForm } from "react-hook-form";

type NcbiApiKeyFormValues = {
	ncbiApiKey: string;
};

/**
 * Set or clear the instance's NCBI API key.
 *
 * The key raises the rate limit NCBI applies to the deployment's GenBank
 * lookups from three requests a second to ten.
 *
 * **The field starts empty however the setting is stored.** The server reports
 * only whether a key is configured, never the key itself, so there is nothing
 * to fill it in with — saving replaces whatever is stored and clearing removes
 * it.
 */
export default function NcbiApiKey() {
	const { data, isPending, isError } = useFetchSettings();
	const mutation = useUpdateSettings();

	const {
		formState: { errors },
		handleSubmit,
		register,
		reset,
	} = useForm<NcbiApiKeyFormValues>({ defaultValues: { ncbiApiKey: "" } });

	if (isError && !data) {
		return <QueryError noun="settings" />;
	}

	if (isPending) {
		return <LoadingPlaceholder />;
	}

	function save({ ncbiApiKey }: NcbiApiKeyFormValues) {
		mutation.mutate(
			{ ncbiApiKey: ncbiApiKey.trim() },
			{ onSuccess: () => reset() },
		);
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
				<BoxGroupSection>
					<form onSubmit={handleSubmit(save)}>
						<InputGroup>
							<InputLabel htmlFor="ncbiApiKey">API Key</InputLabel>
							<InputPassword
								id="ncbiApiKey"
								aria-describedby="ncbiApiKey-error"
								aria-invalid={Boolean(errors.ncbiApiKey) || undefined}
								autoComplete="off"
								placeholder={
									data.hasNcbiApiKey
										? "A key is configured"
										: "No key configured"
								}
								{...register("ncbiApiKey", {
									required: "An API key is required.",
								})}
							/>
							<InputError id="ncbiApiKey-error">
								{errors.ncbiApiKey?.message}
							</InputError>
						</InputGroup>
						<div className="flex justify-end gap-2">
							{data.hasNcbiApiKey ? (
								<Button
									onClick={() => {
										mutation.mutate(
											{ ncbiApiKey: "" },
											{ onSuccess: () => reset() },
										);
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
