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
					<InputGroup>
						<InputLabel htmlFor="name">Name</InputLabel>
						<InputSimple
							id="name"
							aria-required
							aria-invalid={Boolean(errors.name) || undefined}
							aria-describedby={errors.name ? "name-error" : undefined}
							{...register("name", {
								required: "A name must be provided",
							})}
						/>
						<InputError id="name-error">{errors.name?.message}</InputError>
					</InputGroup>
					<InputGroup>
						<InputLabel htmlFor="nickname">Nickname</InputLabel>
						<InputSimple id="nickname" {...register("nickname")} />
					</InputGroup>

					<DialogFooter>
						<SaveButton />
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
