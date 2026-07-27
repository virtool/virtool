import { useFetchAccount } from "@account/account";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@base/Collapsible";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogTitle,
	DialogTrigger,
} from "@base/Dialog";
import IconButton from "@base/IconButton";
import InputError from "@base/InputError";
import InputGroup from "@base/InputGroup";
import InputLabel from "@base/InputLabel";
import InputSimple from "@base/InputSimple";
import LoadingPlaceholder from "@base/LoadingPlaceholder";
import QueryError from "@base/QueryError";
import SaveButton from "@base/SaveButton";
import { useListGroups } from "@groups/queries";
import type { Label } from "@labels/types";
import { useCreateSample } from "@samples/queries";
import { getCreateSampleRequest, getSampleNameFromReads } from "@samples/utils";
import { getReadsForUpload } from "@uploads/pairing";
import type { Upload } from "@uploads/types";
import { CirclePlus } from "lucide-react";
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import DefaultSubtractionSelector from "./DefaultSubtractionSelector";
import LabelSelector from "./LabelSelector";
import LibraryTypeSelector from "./LibraryTypeSelector";
import ReadPairBadge from "./ReadPairBadge";
import ReadSlot from "./ReadSlot";
import SampleUserGroup from "./SampleUserGroup";

type ReadFilesProps = {
	/** The read files the sample will be created from, in [LEFT, RIGHT] order */
	reads: Upload[];
};

/**
 * The fixed read selection for the sample. The files come from the file the
 * dialog was opened on and can't be changed here.
 */
function ReadFiles({ reads }: ReadFilesProps) {
	return (
		<InputGroup>
			<div className="flex items-center justify-between">
				<InputLabel>Read Files</InputLabel>
				<ReadPairBadge count={reads.length} />
			</div>
			<div className="flex gap-2">
				{reads.map((read, index) => (
					<ReadSlot
						key={read.id}
						file={read}
						label={index === 0 ? "LEFT" : "RIGHT"}
						sub={index === 0 ? "R1" : "R2"}
					/>
				))}
			</div>
		</InputGroup>
	);
}

type FormValues = {
	name: string;
	isolate: string;
	host: string;
	locale: string;
	libraryType: string;
	group: string;
	labels: number[];
	subtractionIds: number[];
};

type CreateSampleFromFileFormProps = {
	/** All labels available for selection */
	labels: Label[];

	/** Closes the dialog after a sample is created */
	onClose: () => void;

	/** The read files the sample will be created from, in [LEFT, RIGHT] order */
	reads: Upload[];
};

function CreateSampleFromFileForm({
	labels,
	onClose,
	reads,
}: CreateSampleFromFileFormProps) {
	const {
		data: groups,
		isError: isErrorGroups,
		isPending: isPendingGroups,
	} = useListGroups();
	const {
		data: account,
		isError: isErrorAccount,
		isPending: isPendingAccount,
	} = useFetchAccount();

	const {
		control,
		formState: { errors },
		handleSubmit,
		register,
		setValue,
	} = useForm<FormValues>({
		defaultValues: {
			name: getSampleNameFromReads(reads),
			isolate: "",
			host: "",
			locale: "",
			libraryType: "normal",
			group: "",
			labels: [],
			subtractionIds: [],
		},
	});

	const mutation = useCreateSample();

	const [showMetadata, setShowMetadata] = useState(false);

	useEffect(() => {
		setValue("group", String(account?.primary_group?.id ?? ""));
	}, [account, setValue]);

	function onSubmit(values: FormValues) {
		mutation.mutate(
			getCreateSampleRequest(
				values,
				reads.map((read) => read.id),
			),
			{ onSuccess: onClose },
		);
	}

	return (
		<>
			<DialogTitle>Create Sample</DialogTitle>

			<InputError className="text-left">
				{mutation.isError && mutation.error.message}
			</InputError>

			{(isErrorGroups && !groups) || (isErrorAccount && !account) ? (
				<QueryError noun="the sample form" />
			) : isPendingGroups || isPendingAccount || !groups ? (
				<LoadingPlaceholder className="mt-9" />
			) : (
				<form onSubmit={handleSubmit(onSubmit)}>
					<ReadFiles reads={reads} />

					<InputGroup>
						<InputLabel htmlFor="name">Name</InputLabel>
						<InputSimple
							id="name"
							aria-required
							aria-invalid={Boolean(errors.name) || undefined}
							aria-describedby={errors.name ? "name-error" : undefined}
							{...register("name", { required: "Required Field" })}
						/>
						<InputError id="name-error">{errors.name?.message}</InputError>
					</InputGroup>

					<Controller
						control={control}
						render={({ field: { onChange, value } }) => (
							<SampleUserGroup
								selected={value}
								groups={groups}
								onChange={onChange}
							/>
						)}
						name="group"
					/>

					<Collapsible
						className="mb-4"
						open={showMetadata}
						onOpenChange={setShowMetadata}
					>
						<CollapsibleTrigger>Show Metadata Fields</CollapsibleTrigger>
						<CollapsibleContent className="grid grid-cols-3 gap-x-4 pt-4">
							<InputGroup>
								<InputLabel htmlFor="locale">Locale</InputLabel>
								<InputSimple id="locale" {...register("locale")} />
							</InputGroup>

							<InputGroup>
								<InputLabel htmlFor="isolate">Isolate</InputLabel>
								<InputSimple id="isolate" {...register("isolate")} />
							</InputGroup>

							<InputGroup>
								<InputLabel htmlFor="host">Host</InputLabel>
								<InputSimple id="host" {...register("host")} />
							</InputGroup>
						</CollapsibleContent>
					</Collapsible>

					<Controller
						control={control}
						render={({ field: { onChange, value } }) => (
							<LibraryTypeSelector libraryType={value} onSelect={onChange} />
						)}
						name="libraryType"
					/>

					<Controller
						control={control}
						render={({ field: { onChange, value } }) => (
							<LabelSelector
								labels={labels}
								selected={value}
								onChange={onChange}
							/>
						)}
						name="labels"
					/>

					<Controller
						control={control}
						render={({ field: { onChange, value } }) => (
							<DefaultSubtractionSelector
								selected={value}
								onChange={onChange}
							/>
						)}
						name="subtractionIds"
					/>

					<DialogFooter>
						<SaveButton />
					</DialogFooter>
				</form>
			)}
		</>
	);
}

type CreateSampleFromFileProps = {
	/** All labels available for selection */
	labels: Label[];

	/** The read file the sample will be created from */
	upload: Upload;

	/** The read files listed alongside ``upload``, used to detect its mate */
	uploads: Upload[];
};

/**
 * Creates a sample from a read file in the file manager. The read selection is
 * fixed to that file — and its mate, when one is detected — but every other
 * field of the sample can be set here.
 */
export default function CreateSampleFromFile({
	labels,
	upload,
	uploads,
}: CreateSampleFromFileProps) {
	const [open, setOpen] = useState(false);

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<IconButton
				as={DialogTrigger}
				color="blue"
				IconComponent={CirclePlus}
				tip="create sample"
			/>
			<DialogContent size="lg">
				<CreateSampleFromFileForm
					labels={labels}
					onClose={() => setOpen(false)}
					reads={getReadsForUpload(upload, uploads)}
				/>
			</DialogContent>
		</Dialog>
	);
}
