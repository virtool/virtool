import { useFetchAccount } from "@account/account";
import { pluralize } from "@app/format";
import Alert from "@base/Alert";
import { BoxGroup, BoxGroupTable } from "@base/Box";
import Button from "@base/Button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogTitle,
	DialogTrigger,
} from "@base/Dialog";
import { IconButton } from "@base/Icon";
import {
	InputContainer,
	InputError,
	InputIconButton,
	InputSimple,
} from "@base/Input";
import LoadingPlaceholder from "@base/LoadingPlaceholder";
import QueryError from "@base/QueryError";
import SaveButton from "@base/SaveButton";
import { TableActionsCell, TableActionsHead, TableHead } from "@base/Table";
import { useListGroups } from "@groups/queries";
import { useCreateSamples } from "@samples/queries";
import { getCreateSampleRequest, getSampleNameFromReads } from "@samples/utils";
import {
	buildReadRows,
	getReadRowKey,
	getReadRowReads,
} from "@uploads/pairing";
import type { Label, Upload } from "@virtool/contracts";
import { AlertCircle, PencilOff, X } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { Controller, useFieldArray, useForm, useWatch } from "react-hook-form";
import BulkRename from "./BulkRename";
import ReadPairBadge from "./ReadPairBadge";
import SampleSettingsFields from "./SampleSettingsFields";
import { type SampleSettingsValues, sampleSettingsDefaults } from "./settings";

/** One sample in the batch: its name and the reads it is created from. */
type SampleRow = {
	/** A stable key for the row, from the read row it was built from */
	key: string;

	name: string;

	/** The read files the sample will be created from, in [LEFT, RIGHT] order */
	reads: Upload[];
};

type FormValues = {
	settings: SampleSettingsValues;
	samples: SampleRow[];
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
			settings: sampleSettingsDefaults,
			samples: buildSampleRows(selected),
		},
	});

	const { fields, remove, replace } = useFieldArray({
		control,
		name: "samples",
	});

	const nameErrorPrefix = useId();
	const samples = useWatch({ control, name: "samples" });
	const nameCounts = new Map<string, number>();
	for (const sample of samples) {
		const name = sample.name.trim();
		nameCounts.set(name, (nameCounts.get(name) ?? 0) + 1);
	}
	const hasDuplicates = samples.some(
		(sample) => (nameCounts.get(sample.name.trim()) ?? 0) > 1,
	);

	function renameSamples(names: string[]) {
		for (const [index, name] of names.entries()) {
			setValue(`samples.${index}.name`, name, {
				shouldDirty: true,
				shouldValidate: true,
			});
		}
	}

	const mutation = useCreateSamples();

	const [failedCount, setFailedCount] = useState(0);

	useEffect(() => {
		setValue("settings.group", String(account?.primaryGroup?.id ?? ""));
	}, [account, setValue]);

	function onSubmit(values: FormValues) {
		const names = values.samples.map((sample) => sample.name.trim());
		if (
			new Set(names).size !== names.length ||
			!names.length ||
			mutation.isPending
		) {
			return;
		}
		const requests = values.samples.map((sample) =>
			getCreateSampleRequest(
				{ ...values.settings, name: sample.name },
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

			<div className="flex flex-col gap-6 lg:flex-row">
				<div className="min-w-0 flex-1">
					<BoxGroup className="max-h-192 overflow-y-auto">
						<BulkRename
							names={samples.map((sample) => sample.name)}
							onRename={renameSamples}
						/>
						<BoxGroupTable className="table-fixed" variant="data">
							<caption className="sr-only">Samples</caption>
							<TableHead className="sticky top-0 z-10">
								<th scope="col">Name</th>
								<th scope="col">Read Files</th>
								<th className="w-28" scope="col">
									Pairing
								</th>
								<TableActionsHead className="w-14" />
							</TableHead>
							<tbody>
								{fields.map((field, index) => {
									const isDuplicate =
										(nameCounts.get(samples[index]?.name.trim() ?? "") ?? 0) >
										1;
									const error = isDuplicate
										? "Duplicate sample name"
										: errors.samples?.[index]?.name?.message;
									const initialName = getSampleNameFromReads(field.reads);
									const errorId = `${nameErrorPrefix}-${index}`;

									return (
										<tr key={field.id}>
											<td>
												<InputContainer align="right" className="items-center">
													<InputSimple
														aria-describedby={error ? errorId : undefined}
														aria-invalid={Boolean(error) || undefined}
														aria-label={`Name for ${field.reads[0]?.name}`}
														{...register(`samples.${index}.name`, {
															validate: (name) =>
																Boolean(name.trim()) || "Required Field",
														})}
													/>
													{samples[index]?.name !== initialName && (
														<InputIconButton
															IconComponent={PencilOff}
															ariaLabel={`Reset name for ${field.reads[0]?.name}`}
															tip="Reset name"
															onClick={() =>
																setValue(`samples.${index}.name`, initialName, {
																	shouldDirty: true,
																	shouldValidate: true,
																})
															}
														/>
													)}
												</InputContainer>
												<InputError id={errorId}>{error}</InputError>
											</td>
											<td>
												<div className="flex flex-col gap-1">
													{field.reads.map((read) => (
														<span
															className="break-all font-mono text-xs text-gray-500"
															key={read.id}
														>
															{read.name}
														</span>
													))}
												</div>
											</td>
											<td>
												<ReadPairBadge count={field.reads.length} />
											</td>
											<TableActionsCell>
												<IconButton
													ariaLabel={`Remove ${field.reads[0]?.name}`}
													color="gray"
													IconComponent={X}
													onClick={() => remove(index)}
													tip="remove"
												/>
											</TableActionsCell>
										</tr>
									);
								})}
							</tbody>
						</BoxGroupTable>
					</BoxGroup>
				</div>
				<div className="w-full min-w-0 lg:w-80 lg:shrink-0">
					<p className="mb-4 text-sm text-gray-500">Applies to every sample.</p>
					<Controller
						control={control}
						name="settings"
						render={({ field }) => (
							<SampleSettingsFields
								groups={groups}
								labels={labels}
								value={field.value}
								onChange={field.onChange}
							/>
						)}
					/>
				</div>
			</div>

			<DialogFooter>
				<SaveButton
					disabled={fields.length === 0 || hasDuplicates || mutation.isPending}
				/>
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
				Create Samples
			</Button>
			<DialogContent className="w-11/12 max-w-7xl">
				<DialogTitle>Create Samples</DialogTitle>
				<DialogDescription>
					Create samples from the selected read files.
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
