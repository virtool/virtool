import { buttonVariants } from "@base/Button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogTitle,
	DialogTrigger,
} from "@base/Dialog";
import Field, {
	FieldError,
	FieldLabel,
	FieldLegend,
	FieldSet,
} from "@base/Field";
import Input from "@base/Input";
import LoadingPlaceholder from "@base/LoadingPlaceholder";
import QueryError from "@base/QueryError";
import SaveButton from "@base/SaveButton";
import { useInfiniteFindFiles } from "@uploads/queries";
import { useId, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useCreateSubtraction } from "../queries";
import { SubtractionFileSelector } from "./SubtractionFileSelector";

type FormValues = {
	name: string;
	nickname: string;
	uploadId: number[];
};

/**
 * Displays a dialog for creating a subtraction
 */
export default function SubtractionCreate() {
	const [open, setOpen] = useState(false);
	const filesLabelId = useId();

	const {
		formState: { errors },
		control,
		register,
		handleSubmit,
		reset,
	} = useForm<FormValues>({
		defaultValues: { name: "", nickname: "", uploadId: [] },
	});

	const {
		data: files,
		isPending,
		isError,
		isFetchingNextPage,
		fetchNextPage,
	} = useInfiniteFindFiles("subtraction", 25);

	const mutation = useCreateSubtraction();

	function onSubmit({ name, nickname, uploadId }: FormValues) {
		const id = uploadId[0];
		if (id === undefined) {
			return;
		}

		mutation.mutate(
			{ name, nickname, uploadId: id },
			{
				onSuccess: () => {
					setOpen(false);
					reset();
				},
			},
		);
	}

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger className={buttonVariants({ color: "blue" })}>
				Create
			</DialogTrigger>
			<DialogContent size="lg">
				<DialogTitle>Create Subtraction</DialogTitle>
				<DialogDescription>
					Create a new subtraction from a FASTA file.
				</DialogDescription>
				{isError && !files ? (
					<QueryError noun="files" />
				) : isPending ? (
					<LoadingPlaceholder className="mt-9" />
				) : (
					<form onSubmit={handleSubmit(onSubmit)}>
						<Field>
							<FieldLabel>Name</FieldLabel>
							<Input
								aria-required
								{...register("name", {
									required: "A name is required",
								})}
							/>
							<FieldError errors={[errors.name]} />
						</Field>

						<Field>
							<FieldLabel>Nickname</FieldLabel>
							<Input {...register("nickname")} />
						</Field>

						<FieldSet>
							<FieldLegend id={filesLabelId} variant="label">
								Files
							</FieldLegend>
							<Field className="mb-0 pb-0">
								<Controller
									name="uploadId"
									control={control}
									render={({ field: { onChange, value } }) => (
										<SubtractionFileSelector
											aria-labelledby={filesLabelId}
											onClick={onChange}
											error={errors.uploadId?.message ?? ""}
											files={files}
											isFetchingNextPage={isFetchingNextPage}
											fetchNextPage={fetchNextPage}
											isPending={isPending}
											foundCount={files.pages[0]?.foundCount ?? 0}
											selected={value}
										/>
									)}
									rules={{ required: "Please select a file" }}
								/>
							</Field>
						</FieldSet>
						<DialogFooter>
							<SaveButton />
						</DialogFooter>
					</form>
				)}
			</DialogContent>
		</Dialog>
	);
}
