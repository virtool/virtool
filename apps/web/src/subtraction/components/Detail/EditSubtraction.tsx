import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogTitle,
	DialogTrigger,
} from "@base/Dialog";
import Field, { FieldError, FieldLabel } from "@base/Field";
import { IconButton } from "@base/Icon";
import Input from "@base/Input";
import SaveButton from "@base/SaveButton";
import { useUpdateSubtraction } from "@subtraction/queries";
import type { Subtraction } from "@virtool/contracts";
import { Pencil } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";

export type EditSubtractionProps = {
	/** The subtraction data */
	subtraction: Subtraction;
};

type EditSubtractionFormValues = {
	name: string;
	nickname: string;
};

/**
 * Dialog for editing an existing subtraction
 */
export default function EditSubtraction({ subtraction }: EditSubtractionProps) {
	const [open, setOpen] = useState(false);
	const mutation = useUpdateSubtraction(subtraction.id);

	const {
		formState: { errors },
		register,
		handleSubmit,
	} = useForm<EditSubtractionFormValues>({
		defaultValues: {
			name: subtraction.name,
			nickname: subtraction.nickname,
		},
	});

	function onSubmit({ name, nickname }: EditSubtractionFormValues) {
		mutation.mutate({ name, nickname }, { onSuccess: () => setOpen(false) });
	}

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>
				<IconButton IconComponent={Pencil} color="gray" tip="modify" />
			</DialogTrigger>
			<DialogContent>
				<DialogTitle>Edit Subtraction</DialogTitle>
				<form onSubmit={handleSubmit((values) => onSubmit({ ...values }))}>
					<Field>
						<FieldLabel>Name</FieldLabel>
						<Input
							aria-required
							{...register("name", {
								required: "A name must be provided",
							})}
						/>
						<FieldError errors={[errors.name]} />
					</Field>
					<Field>
						<FieldLabel>Nickname</FieldLabel>
						<Input {...register("nickname")} />
					</Field>

					<DialogFooter>
						<SaveButton />
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
