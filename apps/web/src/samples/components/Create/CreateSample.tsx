import { useFetchAccount } from "@account/account";
import Button from "@base/Button";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@base/Collapsible";
import ContainerNarrow from "@base/ContainerNarrow";
import InputContainer from "@base/InputContainer";
import InputError from "@base/InputError";
import InputGroup from "@base/InputGroup";
import InputIconButton from "@base/InputIconButton";
import InputLabel from "@base/InputLabel";
import InputSimple from "@base/InputSimple";
import LoadingPlaceholder from "@base/LoadingPlaceholder";
import QueryError from "@base/QueryError";
import SaveButton from "@base/SaveButton";
import Switch from "@base/Switch";
import {
	Toast,
	ToastClose,
	ToastDescription,
	ToastProvider,
	ToastTitle,
	ToastViewport,
} from "@base/Toast";
import ViewHeader from "@base/ViewHeader";
import ViewHeaderTitle from "@base/ViewHeaderTitle";
import { useListGroups } from "@groups/queries";
import { useCreateSample } from "@samples/queries";
import { getCreateSampleRequest, getSampleNameFromReads } from "@samples/utils";
import { useNavigate } from "@tanstack/react-router";
import { useInfiniteFindFiles } from "@uploads/queries";
import type { Label, Sample } from "@virtool/contracts";
import { WandSparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import DefaultSubtractionSelector from "./DefaultSubtractionSelector";
import LabelSelector from "./LabelSelector";
import LibraryTypeSelector from "./LibraryTypeSelector";
import ReadSelector from "./ReadSelector";
import SampleUserGroup from "./SampleUserGroup";

type FormValues = {
	name: string;
	isolate: string;
	host: string;
	locale: string;
	libraryType: string;
	readFiles: number[];
	group: string;
	labels: number[];
	subtractionIds: number[];
};

const emptyValues: FormValues = {
	name: "",
	isolate: "",
	host: "",
	locale: "",
	libraryType: "normal",
	readFiles: [],
	group: "",
	labels: [],
	subtractionIds: [],
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

	const [showMetadata, setShowMetadata] = useState(false);
	const [createMore, setCreateMore] = useState(false);
	const [createdSample, setCreatedSample] = useState<Sample | null>(null);

	useEffect(() => {
		setValue("group", String(account?.primaryGroup?.id ?? ""));
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
			group: String(account?.primaryGroup?.id ?? ""),
		});
	}

	function handleReset() {
		clearForm();
		mutation.reset();
	}

	function onSubmit(values: FormValues) {
		mutation.mutate(getCreateSampleRequest(values, values.readFiles), {
			onSuccess: (sample) => {
				clearForm();

				if (createMore) {
					setCreatedSample(sample);
					return;
				}

				navigate({ to: "/samples" });
			},
		});
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
							<CollapsibleContent className="grid grid-cols-2 gap-x-4 pt-4">
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

								<div className="flex gap-2">
									<Button onClick={handleReset} type="button">
										Reset Form
									</Button>
									<SaveButton />
								</div>
							</div>
						</div>
					</>
				)}
			</form>

			<ToastProvider>
				{createdSample && (
					<Toast
						key={createdSample.id}
						onOpenChange={(open) => {
							if (!open) {
								setCreatedSample(null);
							}
						}}
						open
					>
						<div>
							<ToastTitle>Sample created</ToastTitle>
							<ToastDescription>{createdSample.name}</ToastDescription>
						</div>
						<ToastClose />
					</Toast>
				)}
				<ToastViewport />
			</ToastProvider>
		</ContainerNarrow>
	);
}
