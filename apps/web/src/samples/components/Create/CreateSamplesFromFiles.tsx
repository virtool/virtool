import { useFetchAccount } from "@account/account";
import { pluralize } from "@app/format";
import Alert from "@base/Alert";
import Button from "@base/Button";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@base/Collapsible";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogTitle,
	DialogTrigger,
} from "@base/Dialog";
import Icon, { IconButton } from "@base/Icon";
import { InputError, InputGroup, InputLabel, InputSimple } from "@base/Input";
import LoadingPlaceholder from "@base/LoadingPlaceholder";
import QueryError from "@base/QueryError";
import SaveButton from "@base/SaveButton";
import { useListGroups } from "@groups/queries";
import { useCreateSamples } from "@samples/queries";
import { getCreateSampleRequest, getSampleNameFromReads } from "@samples/utils";
import {
	buildReadRows,
	getReadRowKey,
	getReadRowReads,
} from "@uploads/pairing";
import type { Label, Upload } from "@virtool/contracts";
import { AlertCircle, CirclePlus, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import DefaultSubtractionSelector from "./DefaultSubtractionSelector";
import LabelSelector from "./LabelSelector";
import LibraryTypeSelector from "./LibraryTypeSelector";
import ReadPairBadge from "./ReadPairBadge";
import SampleUserGroup from "./SampleUserGroup";

/** One sample in the batch: its name and the reads it is created from. */
type SampleRow = {
	/** A stable key for the row, from the read row it was built from */
	key: string;

	name: string;

	/** The read files the sample will be created from, in [LEFT, RIGHT] order */
	reads: Upload[];
};

type FormValues = {
	group: string;
	host: string;
	isolate: string;
	labels: number[];
	libraryType: string;
	locale: string;
	samples: SampleRow[];
	subtractionIds: number[];
};

/**
 * Groups the selected read files into one row per sample, collapsing detected
 * mate pairs. A file whose mate isn't selected becomes an unpaired sample.
 *
 * @param selected - the selected read files
 */
function buildSampleRows(selected: Upload[]): SampleRow[] {
	return buildReadRows(selected).map((row) => {
		const reads = getReadRowReads(row);

		return {
			key: getReadRowKey(row),
			name: getSampleNameFromReads(reads),
			reads,
		};
	});
}

type CreateSamplesFormProps = {
	/** All labels available for selection */
	labels: Label[];

	/** Closes the dialog */
	onClose: () => void;

	/** Drops the created files from the selection they were made from */
	onCreated: () => void;

	/** The selected read files the batch is built from */
	selected: Upload[];
};

function CreateSamplesForm({
	labels,
	onClose,
	onCreated,
	selected,
}: CreateSamplesFormProps) {
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
			group: "",
			host: "",
			isolate: "",
			labels: [],
			libraryType: "normal",
			locale: "",
			samples: buildSampleRows(selected),
			subtractionIds: [],
		},
	});

	const { fields, remove, replace } = useFieldArray({
		control,
		name: "samples",
	});

	const mutation = useCreateSamples();

	const [showMetadata, setShowMetadata] = useState(false);
	const [failedCount, setFailedCount] = useState(0);

	useEffect(() => {
		setValue("group", String(account?.primaryGroup?.id ?? ""));
	}, [account, setValue]);

	function onSubmit(values: FormValues) {
		const requests = values.samples.map((sample) =>
			getCreateSampleRequest(
				{
					group: values.group,
					host: values.host,
					isolate: values.isolate,
					labels: values.labels,
					libraryType: values.libraryType,
					locale: values.locale,
					name: sample.name,
					subtractionIds: values.subtractionIds,
				},
				sample.reads.map((read) => read.id),
			),
		);

		mutation.mutate(requests, {
			onSuccess: ({ created, failed }) => {
				if (created.length) {
					onCreated();
				}

				if (!failed.length) {
					onClose();
					return;
				}

				// The created samples reserved their reads, so only the failed rows
				// can still be submitted. Keeping them on screen lets the user fix
				// and retry without reselecting anything.
				const failedKeys = new Set(
					failed.map(({ request }) => request.files.join()),
				);

				setFailedCount(failed.length);
				replace(
					values.samples.filter((sample) =>
						failedKeys.has(sample.reads.map((read) => read.id).join()),
					),
				);
			},
		});
	}

	if ((isErrorGroups && !groups) || (isErrorAccount && !account)) {
		return <QueryError noun="the sample form" />;
	}

	if (isPendingGroups || isPendingAccount || !groups) {
		return <LoadingPlaceholder className="mt-9" />;
	}

	return (
		<form onSubmit={handleSubmit(onSubmit)}>
			{failedCount > 0 && (
				<Alert color="red" icon={AlertCircle}>
					<span>
						<strong>
							{pluralize(failedCount, "sample")} could not be created.
						</strong>
						<span> The others were created and have left the list.</span>
					</span>
				</Alert>
			)}

			<InputError className="text-left">
				{mutation.isError && mutation.error.message}
			</InputError>

			<InputGroup>
				<InputLabel>Samples</InputLabel>
				<ul className="flex flex-col gap-2">
					{fields.map((field, index) => {
						const error = errors.samples?.[index]?.name;

						return (
							<li
								className="flex items-start gap-3 rounded-md border border-gray-300 p-3"
								key={field.id}
							>
								<div className="flex-1 min-w-0">
									<InputSimple
										aria-invalid={Boolean(error) || undefined}
										aria-label={`Name for ${field.reads[0]?.name}`}
										{...register(`samples.${index}.name`, {
											required: "Required Field",
										})}
									/>
									<InputError>{error?.message}</InputError>
								</div>
								<div className="flex flex-col items-end gap-1 min-w-0">
									<ReadPairBadge count={field.reads.length} />
									{field.reads.map((read) => (
										<span
											className="truncate font-mono text-xs text-gray-500"
											key={read.id}
										>
											{read.name}
										</span>
									))}
								</div>
								<IconButton
									ariaLabel={`Remove ${field.reads[0]?.name}`}
									color="gray"
									IconComponent={X}
									onClick={() => remove(index)}
									tip="remove"
								/>
							</li>
						);
					})}
				</ul>
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
					<LabelSelector labels={labels} selected={value} onChange={onChange} />
				)}
				name="labels"
			/>

			<Controller
				control={control}
				render={({ field: { onChange, value } }) => (
					<DefaultSubtractionSelector selected={value} onChange={onChange} />
				)}
				name="subtractionIds"
			/>

			<DialogFooter>
				<SaveButton disabled={fields.length === 0} />
			</DialogFooter>
		</form>
	);
}

type CreateSamplesFromFilesProps = {
	/** All labels available for selection */
	labels: Label[];

	/** Drops the created files from the selection they were made from */
	onCreated: () => void;

	/** The selected read files the batch is built from */
	selected: Upload[];
};

/**
 * Creates a sample from every selected read file in the file manager. Detected
 * mate pairs become one paired sample, and every other field is shared across
 * the batch.
 */
export default function CreateSamplesFromFiles({
	labels,
	onCreated,
	selected,
}: CreateSamplesFromFilesProps) {
	const [open, setOpen] = useState(false);

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<Button as={DialogTrigger} color="blue" size="small">
				<Icon icon={CirclePlus} /> Create Samples
			</Button>
			<DialogContent size="lg">
				<DialogTitle>Create Samples</DialogTitle>
				<DialogDescription>
					One sample is created for each row. Detected mate pairs are already
					paired, and the fields below apply to every sample in the batch.
				</DialogDescription>
				<CreateSamplesForm
					labels={labels}
					onClose={() => setOpen(false)}
					onCreated={onCreated}
					selected={selected}
				/>
			</DialogContent>
		</Dialog>
	);
}
