import {
	useSuspenseSettings,
	useUpdateSettings,
} from "@administration/queries";
import { BoxGroup, BoxGroupSection } from "@base/Box";
import Input, { InputError, InputGroup, InputLabel } from "@base/Input";
import SaveButton from "@base/SaveButton";
import SectionHeader from "@base/SectionHeader";
import { MAX_UPLOAD_SIZE } from "@virtool/contracts";
import { useForm } from "react-hook-form";

const BYTES_PER_GIGABYTE = 1000 ** 3;

const MAX_GIGABYTES = MAX_UPLOAD_SIZE / BYTES_PER_GIGABYTE;

type MaxUploadSizeFormValues = {
	maximumGigabytes: number;
};

export default function MaxUploadSize() {
	const { data } = useSuspenseSettings();
	const mutation = useUpdateSettings();

	const {
		formState: { errors },
		handleSubmit,
		register,
	} = useForm<MaxUploadSizeFormValues>({
		values: {
			maximumGigabytes: data.maxUploadSize / BYTES_PER_GIGABYTE,
		},
	});

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
