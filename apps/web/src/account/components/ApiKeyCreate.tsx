import Button from "@base/Button";
import CopyField from "@base/CopyField";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogTitle,
	DialogTrigger,
} from "@base/Dialog";
import { InputError, InputGroup, InputLabel, InputSimple } from "@base/Input";
import SaveButton from "@base/SaveButton";
import type { Permissions } from "@virtool/contracts";
import { emptyPermissions } from "@virtool/contracts";
import { useId, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useCreateApiKey } from "../queries";
import ApiKeyAdministratorInfo from "./ApiKeyAdministratorInfo";
import ApiKeyPermissions from "./ApiKeyPermissions";

type FormValues = {
	name: string;
	permissions: Permissions;
};

/**
 * Displays a dialog to create an API key
 */
export default function ApiKeyCreate() {
	const [open, setOpen] = useState(false);
	const [copied, setCopied] = useState(false);
	const [newKey, setNewKey] = useState("");
	const mutation = useCreateApiKey();
	const permissionsLabelId = useId();

	const {
		formState: { errors },
		handleSubmit,
		control,
		register,
		reset,
	} = useForm<FormValues>({
		defaultValues: {
			name: "",
			permissions: emptyPermissions(),
		},
	});

	const showCreated = Boolean(newKey);

	function handleOpenChange(open: boolean) {
		if (!open) {
			setCopied(false);
			setNewKey("");
			reset();
		}
		setOpen(open);
	}

	function onSubmit({ name, permissions }: FormValues) {
		mutation.mutate(
			{ name, permissions },
			{
				onSuccess: (data) => {
					setNewKey(data.key ?? "");
				},
			},
		);
	}

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<Button as={DialogTrigger} color="blue">
				Create
			</Button>
			<DialogContent>
				<DialogTitle>
					{showCreated ? "API Key Created" : "Create API Key"}
				</DialogTitle>
				<DialogDescription>
					{showCreated
						? "Copy this key now. It won’t be shown again."
						: "Create a new key for accessing the Virtool API."}
				</DialogDescription>
				{showCreated ? (
					<>
						<CopyField
							label="API key"
							value={newKey}
							onCopy={() => setCopied(true)}
						/>
						<DialogFooter>
							<Button
								color={copied ? "blue" : "gray"}
								onClick={() => handleOpenChange(false)}
							>
								Done
							</Button>
						</DialogFooter>
					</>
				) : (
					<form onSubmit={handleSubmit(onSubmit)}>
						<ApiKeyAdministratorInfo />
						<InputGroup>
							<InputLabel htmlFor="name">Name</InputLabel>
							<InputSimple
								id="name"
								aria-required
								aria-invalid={Boolean(errors.name) || undefined}
								aria-describedby={errors.name ? "name-error" : undefined}
								{...register("name", {
									required: "Provide a name for the key",
								})}
							/>
							<InputError id="name-error">{errors.name?.message}</InputError>
						</InputGroup>

						<InputLabel id={permissionsLabelId}>Permissions</InputLabel>
						<Controller
							control={control}
							render={({ field: { onChange, value } }) => (
								<ApiKeyPermissions
									aria-labelledby={permissionsLabelId}
									keyPermissions={value}
									onChange={onChange}
								/>
							)}
							name="permissions"
						/>

						<DialogFooter>
							<SaveButton />
						</DialogFooter>
					</form>
				)}
			</DialogContent>
		</Dialog>
	);
}
