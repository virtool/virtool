import { byteSize } from "@app/format";
import { DialogFooter } from "@base/Dialog";
import { InputError, InputGroup, InputLabel, InputSimple } from "@base/Input";
import ProgressBarAffixed from "@base/ProgressBarAffixed";
import SaveButton from "@base/SaveButton";
import TextArea from "@base/TextArea";
import { useNavigate } from "@tanstack/react-router";
import { UploadBar } from "@uploads/components/UploadBar";
import { useUploadPolicy } from "@uploads/queries";
import { useId } from "react";
import { Controller, useForm } from "react-hook-form";
import {
	useCreateReference,
	useImportReference,
	useUploadReference,
} from "../queries";

type FormValues = {
	name: string;
	description: string;
	organism: string;
	upload: string;
};

type CreateReferenceFormProps = {
	mode: "empty" | "import";
	onSuccess: () => void;
};

/**
 * A form for creating a reference from scratch or by importing a file, sharing
 * name and description between the two modes
 */
export function CreateReferenceForm({
	mode,
	onSuccess,
}: CreateReferenceFormProps) {
	const navigate = useNavigate();
	const createMutation = useCreateReference();
	const importMutation = useImportReference();
	const { uploadMutation, fileName, uploadId, progress } = useUploadReference();
	const { data: policy } = useUploadPolicy();

	const nameId = useId();
	const organismId = useId();
	const descriptionId = useId();

	const {
		control,
		formState: { errors },
		handleSubmit,
		register,
		setError,
	} = useForm<FormValues>({
		defaultValues: {
			name: "",
			description: "",
			organism: "",
			upload: "",
		},
	});

	// Refused here rather than after the transfer starts. Until the policy
	// resolves the file is offered, and upload initialization refuses it with the
	// same message.
	function handleDrop(acceptedFiles: File[]): boolean {
		const file = acceptedFiles[0];
		if (file === undefined) {
			return false;
		}

		if (policy && file.size > policy.maxUploadSize) {
			setError("upload", {
				message: `The file exceeds the ${byteSize(policy.maxUploadSize, true)} maximum upload size`,
			});
			return false;
		}

		uploadMutation.mutate(file);
		return true;
	}

	function onSubmit(values: FormValues) {
		if (mode === "import") {
			if (uploadId === null) {
				setError("upload", {
					message: "Please wait for the upload to finish",
				});
				return;
			}

			importMutation.mutate(
				{
					name: values.name,
					description: values.description,
					importFrom: uploadId,
				},
				{
					onSuccess: () => {
						navigate({ to: "/refs", replace: true });
						onSuccess();
					},
				},
			);

			return;
		}

		createMutation.mutate(
			{
				name: values.name,
				description: values.description,
				organism: values.organism,
			},
			{
				onSuccess: () => {
					navigate({ to: "/refs" });
					onSuccess();
				},
			},
		);
	}

	const uploadBarMessage =
		fileName || (progress > 0 ? "Uploading..." : undefined);

	return (
		<form onSubmit={handleSubmit(onSubmit)}>
			{mode === "import" && (
				<Controller
					control={control}
					name="upload"
					rules={{ required: "A reference file must be uploaded" }}
					render={({ field: { onChange } }) => (
						<div className="mb-4">
							<ProgressBarAffixed color="green" now={progress} />
							<UploadBar
								message={uploadBarMessage}
								onDrop={(acceptedFiles) => {
									const file = acceptedFiles[0];
									if (handleDrop(acceptedFiles) && file) {
										onChange(file.name);
									}
								}}
								multiple={false}
							/>

							<InputError>{errors.upload?.message}</InputError>
						</div>
					)}
				/>
			)}

			<InputGroup className="pb-0">
				<InputLabel htmlFor={nameId}>Name</InputLabel>
				<InputSimple
					id={nameId}
					aria-required
					aria-invalid={Boolean(errors.name) || undefined}
					aria-describedby={errors.name ? `${nameId}-error` : undefined}
					{...register("name", { required: "Required Field" })}
				/>
				<InputError id={`${nameId}-error`}>{errors.name?.message}</InputError>
			</InputGroup>

			{mode === "empty" && (
				<InputGroup>
					<InputLabel htmlFor={organismId}>Organism</InputLabel>
					<InputSimple id={organismId} {...register("organism")} />
				</InputGroup>
			)}

			<InputGroup>
				<InputLabel htmlFor={descriptionId}>Description</InputLabel>
				<TextArea id={descriptionId} {...register("description")} />
			</InputGroup>

			<DialogFooter>
				<SaveButton
					altText="Create"
					disabled={mode === "import" && progress > 0 && uploadId === null}
				/>
			</DialogFooter>
		</form>
	);
}
