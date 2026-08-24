import { Dialog, DialogContent, DialogFooter, DialogTitle } from "@base/Dialog";
import { InputError, InputGroup, InputLabel, InputSimple } from "@base/Input";
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
					<InputGroup>
						<InputLabel htmlFor="name">Name</InputLabel>
						<InputSimple
							id="name"
							aria-required
							aria-invalid={Boolean(errors.name) || undefined}
							aria-describedby={errors.name ? "name-error" : undefined}
							{...register("name", {
								required: "Provide a name for the group",
							})}
						/>
						<InputError id="name-error">{errors.name?.message}</InputError>
					</InputGroup>
					<DialogFooter>
						<SaveButton />
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
