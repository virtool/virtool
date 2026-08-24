import { Dialog, DialogContent, DialogFooter, DialogTitle } from "@base/Dialog";
import { IconButton } from "@base/Icon";
import SaveButton from "@base/SaveButton";
import { useUpdateReference } from "@references/queries";
import type { Reference } from "@virtool/contracts";
import { Pencil } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { ReferenceForm } from "../ReferenceForm";

export type FormValues = {
	name: string;
	description: string;
	organism: string;
};

type EditReferenceProps = {
	/** The reference details */
	detail: Reference;
};

/**
 * A modify icon button and the dialog it opens for editing a reference
 */
export default function EditReference({ detail }: EditReferenceProps) {
	const [open, setOpen] = useState(false);
	const {
		formState: { errors },
		handleSubmit,
		register,
	} = useForm<FormValues>({
		defaultValues: {
			name: detail.name,
			description: detail.description,
			organism: detail.organism,
		},
	});
	const { mutation } = useUpdateReference(detail.id);

	function handleEdit({ name, description, organism }: FormValues) {
		mutation.mutate(
			{ name, description, organism },
			{
				onSuccess: () => setOpen(false),
			},
		);
	}

	function handleOpenChange(next: boolean) {
		if (!next) {
			mutation.reset();
			setOpen(false);
		}
	}

	return (
		<>
			<IconButton
				color="gray"
				IconComponent={Pencil}
				tip="modify"
				onClick={() => setOpen(true)}
			/>
			<Dialog open={open} onOpenChange={handleOpenChange}>
				<DialogContent>
					<DialogTitle>Edit Reference</DialogTitle>
					<form onSubmit={handleSubmit((values) => handleEdit({ ...values }))}>
						<ReferenceForm errors={errors} mode="edit" register={register} />
						<DialogFooter>
							<SaveButton />
						</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>
		</>
	);
}
