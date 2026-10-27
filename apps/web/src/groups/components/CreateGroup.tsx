import { Dialog, DialogContent, DialogFooter, DialogTitle } from "@base/Dialog";
import Field, { FieldError, FieldLabel } from "@base/Field";
import Input from "@base/Input";
import SaveButton from "@base/SaveButton";
import { useForm } from "react-hook-form";
import { useCreateGroup } from "../queries";

type FormValues = {
	name: string;
};

type CreateGroupProps = {
	open?: boolean;
	setOpen?: (open: boolean) => void;
};

/**
 * A dialog for creating a new group
 */
export default function CreateGroup({
	open = false,
	setOpen = () => {},
}: CreateGroupProps) {
	const createGroupMutation = useCreateGroup();
	const {
		formState: { errors },
		register,
		handleSubmit,
	} = useForm<FormValues>({ defaultValues: { name: "" } });

	function onSubmit({ name }: FormValues) {
		createGroupMutation.mutate(
			{ name },
			{
				onSuccess: () => {
					setOpen(false);
				},
			},
		);
	}

	return (
		<Dialog open={open} onOpenChange={() => setOpen(false)}>
			<DialogContent>
				<DialogTitle>Create Group</DialogTitle>
				<form onSubmit={handleSubmit(onSubmit)}>
					<Field>
						<FieldLabel>Name</FieldLabel>
						<Input
							aria-required
							{...register("name", {
								required: "Provide a name for the group",
							})}
						/>
						<FieldError errors={[errors.name]} />
					</Field>
					<DialogFooter>
						<SaveButton />
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
