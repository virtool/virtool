import { useFetchSettings, useUpdateSettings } from "@administration/queries";
import { BoxGroup, BoxGroupSection } from "@base/Box";
import Input, { InputError, InputGroup, InputLabel } from "@base/Input";
import LoadingPlaceholder from "@base/LoadingPlaceholder";
import QueryError from "@base/QueryError";
import SaveButton from "@base/SaveButton";
import SectionHeader from "@base/SectionHeader";
import { AZURE_MAX_BLOB_SIZE } from "@virtool/contracts";
import { useForm } from "react-hook-form";

/** The field is entered and shown in gigabytes; the setting is stored in bytes. */
const BYTES_PER_GIGABYTE = 1_000_000_000;

/** The largest maximum the Azure block blob protocol can honour, in gigabytes. */
const MAX_GIGABYTES = AZURE_MAX_BLOB_SIZE / BYTES_PER_GIGABYTE;

type MaxUploadSizeFormValues = {
	maximumGigabytes: number;
};

/**
 * Set the largest file the instance accepts.
 *
 * Upload initialization refuses anything larger, so an oversized file is
 * rejected before any of its bytes are transferred. The setting is stored in
 * bytes; the field is in gigabytes, which is the unit uploads are reasoned
 * about in.
 */
export default function MaxUploadSize() {
	const { data, isPending, isError } = useFetchSettings();
	const mutation = useUpdateSettings();

	const {
		formState: { errors },
		handleSubmit,
		register,
	} = useForm<MaxUploadSizeFormValues>({
		values: {
			maximumGigabytes: data ? data.maxUploadSize / BYTES_PER_GIGABYTE : 0,
		},
	});

	if (isError && !data) {
		return <QueryError noun="settings" />;
	}

	if (isPending) {
		return <LoadingPlaceholder />;
	}

	function save({ maximumGigabytes }: MaxUploadSizeFormValues) {
		mutation.mutate({
			maxUploadSize: Math.round(maximumGigabytes * BYTES_PER_GIGABYTE),
		});
	}

	return (
		<section>
			<SectionHeader>
				<h2>Maximum Upload Size</h2>
				<p>
					A file larger than this is refused before its transfer begins. It
					applies to every upload, whether it comes from the web interface or
					the API.
				</p>
			</SectionHeader>
			<BoxGroup>
				<BoxGroupSection>
					<form onSubmit={handleSubmit(save)}>
						<InputGroup>
							<InputLabel htmlFor="maxUploadSize">Maximum (GB)</InputLabel>
							<Input
								id="maxUploadSize"
								aria-describedby="maxUploadSize-error"
								aria-invalid={Boolean(errors.maximumGigabytes) || undefined}
								min={1}
								step={1}
								type="number"
								{...register("maximumGigabytes", {
									valueAsNumber: true,
									required: "A maximum is required.",
									min: {
										value: 1,
										message: "The maximum must be at least 1 GB.",
									},
									// The protocol cannot carry a larger blob, so a larger
									// maximum would only ever fail at upload time.
									max: {
										value: MAX_GIGABYTES,
										message: `The maximum cannot exceed ${MAX_GIGABYTES} GB.`,
									},
								})}
							/>
							<InputError id="maxUploadSize-error">
								{errors.maximumGigabytes?.message}
							</InputError>
						</InputGroup>
						<div className="flex justify-end">
							<SaveButton />
						</div>
					</form>
				</BoxGroupSection>
			</BoxGroup>
		</section>
	);
}
