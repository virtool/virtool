import { useFetchAccount } from "@account/account";
import Button from "@base/Button";
import { ContainerNarrow } from "@base/Container";
import CreatedCount from "@base/CreatedCount";
import {
	InputContainer,
	InputError,
	InputGroup,
	InputIconButton,
	InputLabel,
	InputSimple,
} from "@base/Input";
import LoadingPlaceholder from "@base/LoadingPlaceholder";
import QueryError from "@base/QueryError";
import SaveButton from "@base/SaveButton";
import Switch from "@base/Switch";
import { ViewHeader, ViewHeaderTitle } from "@base/View";
import { useListGroups } from "@groups/queries";
import { useCreateSample } from "@samples/queries";
import { getCreateSampleRequest, getSampleNameFromReads } from "@samples/utils";
import { useNavigate } from "@tanstack/react-router";
import { useInfiniteFindFiles } from "@uploads/queries";
import type { Label } from "@virtool/contracts";
import { WandSparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import ReadSelector from "./ReadSelector";
import SampleSettingsFields from "./SampleSettingsFields";
import { type SampleSettingsValues, sampleSettingsDefaults } from "./settings";

type FormValues = {
	settings: SampleSettingsValues;
	name: string;
	readFiles: number[];
};

const emptyValues: FormValues = {
	settings: sampleSettingsDefaults,
	name: "",
	readFiles: [],
};

type CreateSampleProps = {
	labels: Label[];
};

/**
 * A page for creating a sample. Caller provides labels.
 */
export default function CreateSample({ labels }: CreateSampleProps) {
	const navigate = useNavigate();

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
		data: readsResponse,
		isError: isErrorReads,
		isPending: isPendingReads,
		isFetchingNextPage,
		fetchNextPage,
	} = useInfiniteFindFiles("reads", 25);
	const {
		control,
		formState: { errors },
		handleSubmit,
		register,
		reset,
		setValue,
		watch,
	} = useForm<FormValues>({
		defaultValues: emptyValues,
	});
	const mutation = useCreateSample();

	const [createMore, setCreateMore] = useState(false);
	const [createdCount, setCreatedCount] = useState(0);

	useEffect(() => {
		setValue("settings.group", String(account?.primaryGroup?.id ?? ""));
	}, [account, setValue]);

	const reads = readsResponse?.pages.flatMap((page) => page.items) ?? [];
	const isError =
		(isErrorGroups && !groups) ||
		(isErrorAccount && !account) ||
		(isErrorReads && !readsResponse);
	const isLoading =
		isPendingReads ||
		isPendingGroups ||
		isPendingAccount ||
		!readsResponse ||
		!groups;

	function autofill(selected: number[]) {
		const selectedReads = selected.flatMap((id) => {
			const file = reads.find((read) => read.id === id);
			return file ? [file] : [];
		});

		const name = getSampleNameFromReads(selectedReads);

		if (name) {
			setValue("name", name);
		}
	}

	// Restores the account's default group instead of blanking it — the user
	// never chose it, so clearing it would be a surprise.
	function clearForm() {
		reset({
			...emptyValues,
			settings: {
				...sampleSettingsDefaults,
				group: String(account?.primaryGroup?.id ?? ""),
			},
		});
	}

	function handleReset() {
		clearForm();
		mutation.reset();
	}

	function onSubmit(values: FormValues) {
		mutation.mutate(
			getCreateSampleRequest(
				{ ...values.settings, name: values.name },
				values.readFiles,
			),
			{
				onSuccess: () => {
					clearForm();

					if (createMore) {
						setCreatedCount((count) => count + 1);
						return;
					}

					navigate({ to: "/samples" });
				},
			},
		);
	}

	return (
		<ContainerNarrow>
			<form onSubmit={handleSubmit(onSubmit)}>
				<ViewHeader title="Create Sample">
					<ViewHeaderTitle>Create Sample</ViewHeaderTitle>
					<InputError className="text-left">
						{mutation.isError && mutation.error.message}
					</InputError>
				</ViewHeader>

				{isError ? (
					<QueryError noun="the sample form" />
				) : isLoading ? (
					<LoadingPlaceholder className="mt-9" />
				) : (
					<>
						<InputGroup>
							<InputLabel htmlFor="name">Name</InputLabel>
							<InputContainer align="right" className="flex">
								<InputSimple
									id="name"
									aria-required
									aria-invalid={Boolean(errors.name) || undefined}
									aria-describedby={errors.name ? "name-error" : undefined}
									{...register("name", {
										required: "Required Field",
									})}
								/>
								{Boolean(watch("readFiles").length) && (
									<InputIconButton
										IconComponent={WandSparkles}
										aria-label="Auto Fill"
										tip="Auto Fill"
										onClick={() => autofill(watch("readFiles"))}
									/>
								)}
							</InputContainer>
							<InputError id="name-error">{errors.name?.message}</InputError>
						</InputGroup>

						<Controller
							control={control}
							name="settings"
							render={({ field }) => (
								<SampleSettingsFields
									groups={groups}
									labels={labels}
									value={field.value}
									onChange={field.onChange}
									metadataColumns={2}
								/>
							)}
						/>

						<Controller
							control={control}
							render={({ field: { onChange, value } }) => (
								<ReadSelector
									data={readsResponse}
									isFetchingNextPage={isFetchingNextPage}
									fetchNextPage={fetchNextPage}
									isPending={isPendingReads}
									selected={value}
									onSelect={onChange}
									error={errors.readFiles?.message}
								/>
							)}
							name="readFiles"
							rules={{
								required:
									"At least one read file must be attached to the sample",
							}}
						/>

						{/* Sticky so the actions stay in reach while the read selector is
						    scrolled, without leaving the end of the form. The backdrop
						    runs to the bottom of the viewport and fades to transparent
						    across its top padding, so the read selector dissolves as it
						    passes under the bar instead of butting up against it. */}
						<div className="sticky bottom-0 z-10 mt-4 bg-linear-to-b from-white/0 to-white to-40% pt-10 pb-4">
							<div className="flex items-center justify-between rounded-md border border-gray-300 bg-white px-4 py-3 shadow-lg">
								<div className="flex items-center gap-2">
									<Switch
										id="create-more"
										checked={createMore}
										onCheckedChange={setCreateMore}
									/>
									<label
										className="cursor-pointer text-gray-700 text-sm"
										htmlFor="create-more"
									>
										Create more
									</label>
								</div>

								<div className="flex items-center gap-4">
									<CreatedCount
										count={createdCount}
										onExpire={() => setCreatedCount(0)}
										singular="sample"
									/>
									<div className="flex gap-2">
										<Button onClick={handleReset} type="button">
											Reset Form
										</Button>
										<SaveButton />
									</div>
								</div>
							</div>
						</div>
					</>
				)}
			</form>
		</ContainerNarrow>
	);
}
